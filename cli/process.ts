import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  findSourceVideo,
  listProcessedEpisodes,
  loadEpisodeConfig,
  resolveEpisodeDir,
} from "./helpers/config";
import { buildCaptionGroups, buildKeepSegments } from "./helpers/cuts";
import type { EpisodeProps, Transcript } from "./helpers/types";
import {
  GENERATED_EPISODES_INDEX,
  PUBLIC_EPISODES_DIR,
  ROOT,
  SOURCE_DIR,
} from "./helpers/types";
import { probeVideoFps, runWhisper } from "./helpers/whisper";
import { buildEmphasis } from "./modules/emphasis";
import { buildListicle } from "./modules/listicles";
import { buildPunchIns } from "./modules/punchin";
import { renderEpisode } from "./render-episode";

const ALL_PROPS_PATH = path.join(ROOT, "src", "generated", "all-props.json");

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
  const episodes = listProcessedEpisodes();
  writeJson(GENERATED_EPISODES_INDEX, { episodes });

  const allProps: Record<string, EpisodeProps> = {};
  if (fs.existsSync(ALL_PROPS_PATH)) {
    Object.assign(
      allProps,
      JSON.parse(fs.readFileSync(ALL_PROPS_PATH, "utf8")) as Record<
        string,
        EpisodeProps
      >,
    );
  }

  // Drop props for episodes that no longer have generated output
  for (const key of Object.keys(allProps)) {
    if (!episodes.includes(key)) {
      delete allProps[key];
    }
  }

  if (latest) {
    allProps[latest.episodeId] = latest;
  } else {
    for (const id of episodes) {
      const propsPath = path.join(SOURCE_DIR, id, "generated", "props.json");
      if (fs.existsSync(propsPath)) {
        allProps[id] = JSON.parse(
          fs.readFileSync(propsPath, "utf8"),
        ) as EpisodeProps;
      }
    }
  }

  writeJson(ALL_PROPS_PATH, allProps);
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

async function main() {
  const { input, force } = parseArgs(process.argv.slice(2));
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
  console.log(`[process] title="${config.title}"`);

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

  const durationSec = Math.max(
    transcript.duration,
    probe.durationInSeconds,
    ...transcript.words.map((w) => w.end),
  );

  const segments = buildKeepSegments({
    words: transcript.words,
    durationSec,
    fps,
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

  const props: EpisodeProps = {
    episodeId,
    title: config.title,
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
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
