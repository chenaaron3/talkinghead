import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFAULT_PEAKS_PER_SEC,
  peaksFromWavBuffer,
  serializeWaveform,
} from "../../src/lib/audio/waveform";
import type { SerializedWaveform } from "../../src/lib/audio/waveform";
import { ROOT } from "./types";

function extractWav(videoPath: string, wavPath: string): void {
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      videoPath,
      "-ar",
      "16000",
      "-ac",
      "1",
      "-c:a",
      "pcm_s16le",
      wavPath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `ffmpeg failed extracting audio from ${videoPath}\n${result.stderr}`,
    );
  }
}

export function buildWaveform(options: {
  videoPath: string;
  peaksPerSec?: number;
}): SerializedWaveform {
  const peaksPerSec = options.peaksPerSec ?? DEFAULT_PEAKS_PER_SEC;
  const videoStat = fs.statSync(options.videoPath);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talking-head-waveform-"));
  const wavPath = path.join(tmpDir, "audio.wav");

  try {
    console.log(`[waveform] extracting 16kHz wav…`);
    extractWav(options.videoPath, wavPath);
    const data = peaksFromWavBuffer(fs.readFileSync(wavPath), peaksPerSec);
    const duration = data.peaks.length / peaksPerSec;
    console.log(
      `[waveform] wrote ${data.peaks.length} peak(s), duration=${duration.toFixed(2)}s`,
    );
    return serializeWaveform(data, {
      duration,
      source: {
        path: path.relative(ROOT, options.videoPath),
        size: videoStat.size,
        mtimeMs: videoStat.mtimeMs,
      },
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function waveformCacheValid(
  cached: SerializedWaveform,
  videoStat: fs.Stats,
): boolean {
  return (
    cached.peaks.length > 0 &&
    cached.source.size === videoStat.size &&
    Math.abs(cached.source.mtimeMs - videoStat.mtimeMs) < 1
  );
}
