import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { WHISPER_LANGUAGE, WHISPER_MODEL } from "./constants";
import { ROOT } from "./types";

import type { Transcript, TranscriptCaption } from "./types";

const WHISPERMLX_VENV = path.join(ROOT, "whispermlx-env");
const WHISPERMLX_PYTHON = path.join(WHISPERMLX_VENV, "bin", "python3");
const TRANSCRIBE_SCRIPT = path.join(
  ROOT,
  "scripts",
  "whispermlx",
  "transcribe.py",
);

type WhisperMLXPayload = {
  language: string;
  duration: number;
  captions: TranscriptCaption[];
};

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

function ensureWhisperMLX(): void {
  if (!fs.existsSync(WHISPERMLX_PYTHON)) {
    throw new Error(
      `whispermlx venv not found at whispermlx-env/. Run: pnpm setup:whispermlx`,
    );
  }
  if (!fs.existsSync(TRANSCRIBE_SCRIPT)) {
    throw new Error(`Missing whispermlx script: ${TRANSCRIBE_SCRIPT}`);
  }
}

function runWhisperMLXTranscribe(wavPath: string): WhisperMLXPayload {
  const result = spawnSync(
    WHISPERMLX_PYTHON,
    [
      TRANSCRIBE_SCRIPT,
      wavPath,
      "--language",
      WHISPER_LANGUAGE,
      "--model",
      WHISPER_MODEL,
    ],
    {
      encoding: "utf8",
      maxBuffer: 50 * 1024 * 1024,
      // Stream Python progress (model load, align) to the terminal.
      stdio: ["ignore", "pipe", "inherit"],
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `whispermlx failed for ${wavPath}\n${result.stderr || result.stdout}`,
    );
  }

  try {
    return JSON.parse(result.stdout) as WhisperMLXPayload;
  } catch {
    throw new Error(
      `whispermlx returned invalid JSON\n${result.stdout.slice(0, 500)}`,
    );
  }
}

export async function runWhisper(options: {
  videoPath: string;
}): Promise<Omit<Transcript, "source">> {
  ensureWhisperMLX();

  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "talking-head-whispermlx-"),
  );
  const wavPath = path.join(tmpDir, "audio.wav");

  try {
    console.log(`[whispermlx] extracting 16kHz wav…`);
    extractWav(options.videoPath, wavPath);

    console.log(
      `[whispermlx] transcribing model=${WHISPER_MODEL} language=${WHISPER_LANGUAGE}`,
    );
    const payload = runWhisperMLXTranscribe(wavPath);
    const captions = payload.captions;
    const duration = Math.max(payload.duration, ...captions.map((c) => c.end));

    console.log(`[whispermlx] wrote ${captions.length} captions`);

    return {
      language: payload.language || WHISPER_LANGUAGE,
      duration,
      captions,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function probeVideoFps(videoPath: string): {
  fps: number;
  durationInSeconds: number;
  width: number;
  height: number;
} {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,r_frame_rate,avg_frame_rate:format=duration",
      "-of",
      "json",
      videoPath,
    ],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(
      `ffprobe failed for ${videoPath}. Is ffmpeg/ffprobe installed?\n${result.stderr}`,
    );
  }

  const parsed = JSON.parse(result.stdout) as {
    streams?: Array<{
      width?: number;
      height?: number;
      r_frame_rate?: string;
      avg_frame_rate?: string;
    }>;
    format?: { duration?: string };
  };

  const stream = parsed.streams?.[0];
  if (!stream) {
    throw new Error(`No video stream found in ${videoPath}`);
  }

  const rate =
    stream.avg_frame_rate && stream.avg_frame_rate !== "0/0"
      ? stream.avg_frame_rate
      : stream.r_frame_rate;
  if (!rate) {
    throw new Error(`Could not determine FPS for ${videoPath}`);
  }

  const [num, den] = rate.split("/").map(Number);
  const fps = den ? num / den : num;
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new Error(`Invalid FPS "${rate}" for ${videoPath}`);
  }

  const durationInSeconds = Number(parsed.format?.duration ?? 0);
  if (!Number.isFinite(durationInSeconds) || durationInSeconds <= 0) {
    throw new Error(`Could not determine duration for ${videoPath}`);
  }

  return {
    fps,
    durationInSeconds,
    width: stream.width ?? 1080,
    height: stream.height ?? 1920,
  };
}
