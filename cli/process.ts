import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  findSourceVideo,
  loadEpisodeConfig,
  resolveEpisodeDir,
  writeEpisodeTitle,
} from "./helpers/config";
import { buildCaptionGroups, buildKeepSegments } from "./helpers/cuts";
import { rebuildAllPropsIndex } from "./helpers/props-index";
import type { EpisodeProps, Transcript } from "./helpers/types";
import { PUBLIC_EPISODES_DIR, ROOT } from "./helpers/types";
import { probeVideoFps, runWhisper } from "./helpers/whisper";
import { buildEmphasis } from "./modules/emphasis";
import { buildListicle } from "./modules/listicles";
import { buildPunchIns } from "./modules/punchin";
import { buildTitle } from "./modules/title";
import { renderEpisode } from "./render-episode";

function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  if (positional.length === 0) {
    throw new Error(
      "Usage: pnpm process -- source/<episode> [--force]\nExample: pnpm process -- source/day1",
    );
  }
  return { input: positional[0]!, force };
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function refreshEpisodesIndex(latest?: EpisodeProps) {
  const episodes = rebuildAllPropsIndex(latest);
  console.log(
    `[index] ${episodes.length} processed episode(s): ${episodes.join(", ") || "(none)"}`,
  );
}

function linkVideo(videoPath: string, episodeId: string): string {
  const ext = path.extname(videoPath);
  const publicDir = path.join(PUBLIC_EPISODES_DIR, episodeId);
  ensureDir(publicDir);
  const destName = `video${ext.toLowerCase()}`;
  const destPath = path.join(publicDir, destName);

  try {
    fs.lstatSync(destPath);
    fs.unlinkSync(destPath);
  } catch {
    // dest does not exist yet
  }

  // Remotion's render bundle does not follow symlinks out of public/,
  // so hardlink (or copy) the file into public/episodes/<id>/.
  try {
    fs.linkSync(videoPath, destPath);
  } catch {
    console.log(`[media] hardlink failed, copying ${path.basename(videoPath)}`);
    fs.copyFileSync(videoPath, destPath);
  }
  return `episodes/${episodeId}/${destName}`;
}

export async function runProcess(argv: string[]): Promise<{ episodeId: string }> {
  const { input, force } = parseArgs(argv);
  const { episodeId, episodeDir } = resolveEpisodeDir(input);
  const config = loadEpisodeConfig(episodeDir);
  const videoPath = findSourceVideo(episodeDir);
  const videoStat = fs.statSync(videoPath);
  const generatedDir = path.join(episodeDir, "generated");
  ensureDir(generatedDir);

  const transcriptPath = path.join(generatedDir, "transcript.json");
  const probe = probeVideoFps(videoPath);
  const fps = probe.fps;

  console.log(
    `[process] episode=${episodeId} fps=${fps.toFixed(3)} duration=${probe.durationInSeconds.toFixed(2)}s`,
  );
  console.log(`[process] video=${videoPath}`);

  let transcript: Transcript | null = null;
  if (!force && fs.existsSync(transcriptPath)) {
    const cached = JSON.parse(
      fs.readFileSync(transcriptPath, "utf8"),
    ) as Transcript;
    if (
      cached.source &&
      cached.source.size === videoStat.size &&
      Math.abs(cached.source.mtimeMs - videoStat.mtimeMs) < 1
    ) {
      transcript = cached;
      console.log(`[cache] reusing ${transcriptPath}`);
    }
  }

  if (!transcript) {
    const raw = await runWhisper({ videoPath });
    transcript = {
      ...raw,
      source: {
        path: path.relative(ROOT, videoPath),
        size: videoStat.size,
        mtimeMs: videoStat.mtimeMs,
      },
    };
    writeJson(transcriptPath, transcript);
    console.log(`[cache] wrote ${transcriptPath}`);
  }

  let title = config.title;
  if (!title) {
    title = await buildTitle({
      words: transcript.words,
      transcriptPath,
      cachePath: path.join(generatedDir, "title.json"),
      force,
    });
    writeEpisodeTitle(episodeDir, title);
    console.log(`[title] wrote config.yaml`);
  }
  console.log(`[process] title="${title}"`);

  const durationSec = Math.max(
    transcript.duration,
    probe.durationInSeconds,
    ...transcript.words.map((w) => w.end),
  );

  if (config.holds.length > 0) {
    console.log(
      `[holds] ${config.holds.length} range(s): ${config.holds
        .map((h) => `${h.start.toFixed(1)}–${h.end.toFixed(1)}s`)
        .join(", ")}`,
    );
  }

  const segments = buildKeepSegments({
    words: transcript.words,
    durationSec,
    fps,
    holds: config.holds,
  });

  const emphasis = await buildEmphasis({
    enabled: config.emphasis,
    words: transcript.words,
    transcriptPath,
    cachePath: path.join(generatedDir, "emphasis.json"),
    force,
  });

  const captionGroups = buildCaptionGroups({
    words: transcript.words,
    segments,
    fps,
    captionsAtATime: config.captionsAtATime,
    emphasis,
  });

  const listicle = await buildListicle({
    enabled: config.listicle,
    words: transcript.words,
    segments,
    fps,
    transcriptPath,
    cachePath: path.join(generatedDir, "listicle.json"),
    force,
  });

  const punchIns = await buildPunchIns({
    enabled: config.punchIns,
    words: transcript.words,
    segments,
    fps,
    transcriptPath,
    cachePath: path.join(generatedDir, "punch-ins.json"),
    force,
  });

  const durationInFrames = segments.reduce(
    (sum, seg) => sum + seg.durationInFrames,
    0,
  );

  const videoSrc = linkVideo(videoPath, episodeId);

  const propsPath = path.join(generatedDir, "props.json");
  let existingBRolls: EpisodeProps["bRolls"] = [];
  if (fs.existsSync(propsPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(propsPath, "utf8")) as EpisodeProps;
      existingBRolls = prev.bRolls ?? [];
    } catch {
      existingBRolls = [];
    }
  }

  const props: EpisodeProps = {
    episodeId,
    title,
    videoSrc,
    fps,
    width: 1080,
    height: 1920,
    durationInFrames: Math.max(1, durationInFrames),
    titleDurationSec: config.titleDurationSec,
    captionsAtATime: config.captionsAtATime,
    sections: segments.map((seg) => ({
      trimBefore: seg.trimBefore,
      trimAfter: seg.trimAfter,
      durationInFrames: seg.durationInFrames,
    })),
    captionGroups,
    listicle,
    punchIns,
    bRolls: existingBRolls,
  };

  writeJson(path.join(generatedDir, "props.json"), props);

  refreshEpisodesIndex(props);

  const originalSec = durationSec;
  const editedSec = durationInFrames / fps;
  console.log(
    `[done] kept ${segments.length} segment(s); ${originalSec.toFixed(1)}s → ${editedSec.toFixed(1)}s (${captionGroups.length} caption groups)`,
  );
  console.log(`[done] props → source/${episodeId}/generated/props.json`);

  renderEpisode({ episodeId, episodeDir });
  return { episodeId };
}

if (require.main === module) {
  runProcess(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
