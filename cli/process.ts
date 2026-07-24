import "dotenv/config";

import fs from "node:fs";
import path from "node:path";

import { buildProps } from "../src/lib/episode/build-props";
import {
  findSourceVideo,
  loadEpisodeConfig,
  resolveEpisodeDir,
  writeEpisodeConfig,
  writeEpisodeTitle,
} from "./helpers/config";
import { buildCutsFromWords } from "./helpers/cuts";
import { ensurePreviewProxy } from "./helpers/preview-proxy";
import { rebuildAllPropsIndex } from "./helpers/props-index";
import { PUBLIC_EPISODES_DIR, ROOT } from "./helpers/types";
import { buildWaveform, waveformCacheValid } from "./helpers/waveform";
import { probeVideoFps, runWhisper } from "./helpers/whisper";
import { bakeCutout } from "./modules/cutout";
import { buildEmphasisCaptions } from "./modules/emphasis";
import { buildListicleOverlay } from "./modules/listicles";
import { buildPunchInSegments } from "./modules/punchin";
import { buildTitle } from "./modules/title";
import { renderEpisode } from "./render-episode";

import type { SerializedWaveform } from "../src/lib/audio/waveform";
import type { EpisodeProps, Transcript } from "./helpers/types";
function parseArgs(argv: string[]) {
  const force = argv.includes("--force");
  const cutout = argv.includes("--cutout");
  const noRender = argv.includes("--no-render");
  const positional = argv.filter((arg) => !arg.startsWith("--"));
  if (positional.length === 0) {
    throw new Error(
      "Usage: pnpm process -- source/<episode> [--force] [--cutout] [--no-render]\nExample: pnpm process -- source/day1 --cutout",
    );
  }
  return { input: positional[0]!, force, cutout, noRender };
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

  try {
    fs.linkSync(videoPath, destPath);
  } catch {
    console.log(`[media] hardlink failed, copying ${path.basename(videoPath)}`);
    fs.copyFileSync(videoPath, destPath);
  }
  return `episodes/${episodeId}/${destName}`;
}

export async function runProcess(
  argv: string[],
): Promise<{ episodeId: string }> {
  const { input, force, cutout, noRender } = parseArgs(argv);
  const { episodeId, episodeDir } = resolveEpisodeDir(input);
  let config = loadEpisodeConfig(episodeDir);
  const videoPath = findSourceVideo(episodeDir, config.aroll);
  const videoStat = fs.statSync(videoPath);
  const generatedDir = path.join(episodeDir, "generated");
  ensureDir(generatedDir);

  const transcriptPath = path.join(generatedDir, "transcript.json");
  const waveformPath = path.join(generatedDir, "waveform.json");
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
      cached.captions?.length &&
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
      language: raw.language,
      duration: raw.duration,
      captions: raw.captions,
      source: {
        path: path.relative(ROOT, videoPath),
        size: videoStat.size,
        mtimeMs: videoStat.mtimeMs,
      },
    };
    writeJson(transcriptPath, transcript);
    console.log(
      `[cache] wrote ${transcriptPath} (${raw.captions.length} captions)`,
    );
  }

  const durationSec = Math.max(
    transcript.duration,
    probe.durationInSeconds,
    ...transcript.captions.map((c) => c.end),
  );
  transcript = { ...transcript, duration: durationSec };

  let waveform: SerializedWaveform | null = null;
  if (!force && fs.existsSync(waveformPath)) {
    const cached = JSON.parse(
      fs.readFileSync(waveformPath, "utf8"),
    ) as SerializedWaveform;
    if (waveformCacheValid(cached, videoStat)) {
      waveform = cached;
      console.log(`[cache] reusing ${waveformPath}`);
    }
  }
  if (!waveform) {
    waveform = buildWaveform({ videoPath });
    writeJson(waveformPath, waveform);
    console.log(`[cache] wrote ${waveformPath}`);
  }

  let title = config.title;
  if (!title) {
    title = await buildTitle({
      captions: transcript.captions,
      transcriptPath,
      cachePath: path.join(generatedDir, "title.json"),
      force,
    });
    const vfx = writeEpisodeTitle(episodeDir, title);
    config = { ...config, title, vfx };
    console.log(`[title] wrote config.yaml`);
  }
  console.log(`[process] title="${title}"`);

  if (config.cuts.length === 0) {
    const cuts = buildCutsFromWords({
      captions: transcript.captions,
      durationSec,
      fps,
    });
    writeEpisodeConfig(episodeDir, { cuts });
    config = { ...config, cuts };
    console.log(`[cuts] auto-generated ${cuts.length} cut(s)`);
  } else {
    console.log(
      `[cuts] preserving ${config.cuts.length} editor-defined cut(s)`,
    );
  }

  let captions = transcript.captions;
  if (config.emphasis) {
    captions = await buildEmphasisCaptions({
      enabled: config.emphasis,
      captions,
      transcriptPath,
      cachePath: path.join(generatedDir, "emphasis.json"),
      force,
    });
    transcript = { ...transcript, captions };
    writeJson(transcriptPath, transcript);
  }

  if (config.listicle && !config.listicleOverlay) {
    const result = await buildListicleOverlay({
      enabled: config.listicle,
      captions,
      transcriptPath,
      cachePath: path.join(generatedDir, "listicle.json"),
      force,
    });
    if (result) {
      writeEpisodeConfig(episodeDir, {
        listicleOverlay: result.overlay,
        vfx: [...(config.vfx ?? []), ...result.vfx],
      });
      config = {
        ...config,
        listicleOverlay: result.overlay,
        vfx: [...(config.vfx ?? []), ...result.vfx],
      };
    }
  }

  if (config.punchIns && config.punchInSegments.length === 0) {
    const punchInSegments = await buildPunchInSegments({
      enabled: config.punchIns,
      captions,
      transcriptPath,
      cachePath: path.join(generatedDir, "punch-ins.json"),
      force,
    });
    if (punchInSegments.length > 0) {
      writeEpisodeConfig(episodeDir, { punchInSegments });
      config = { ...config, punchInSegments };
    }
  }

  const videoSrc = linkVideo(videoPath, episodeId);
  ensurePreviewProxy(episodeId, videoPath);

  if (cutout) {
    const baked = await bakeCutout({
      episodeId,
      videoPath,
      existing: config.cutout,
    });
    if (!baked.reused || config.cutout?.src !== baked.cutout.src) {
      writeEpisodeConfig(episodeDir, { cutout: baked.cutout });
      config = { ...config, cutout: baked.cutout };
      console.log(`[cutout] wrote config.yaml`);
    } else {
      config = { ...config, cutout: baked.cutout };
    }
  } else if (config.cutout) {
    console.log(`[cutout] using baked ${config.cutout.src}`);
  }

  const props = buildProps({
    episodeId,
    title,
    videoSrc,
    fps,
    config,
    transcript,
  });

  writeJson(path.join(generatedDir, "props.json"), props);
  refreshEpisodesIndex(props);

  const editedSec = props.durationInFrames / fps;
  console.log(
    `[done] ${durationSec.toFixed(1)}s source → ${editedSec.toFixed(1)}s output (${props.captionGroups.length} caption groups)`,
  );
  console.log(`[done] props → source/${episodeId}/generated/props.json`);

  if (noRender) {
    console.log(`[done] skipping render (--no-render)`);
  } else {
    await renderEpisode({ episodeId, episodeDir });
  }
  return { episodeId };
}

if (require.main === module) {
  runProcess(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
