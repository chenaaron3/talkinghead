import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  downloadWhisperModel,
  installWhisperCpp,
  toCaptions,
  transcribe,
} from "@remotion/install-whisper-cpp";
import {
  WHISPER_CPP_VERSION,
  WHISPER_LANGUAGE,
  WHISPER_MODEL,
} from "./constants";
import type { Transcript, TranscriptWord } from "./types";
import { ROOT } from "./types";


const WHISPER_DIR = path.join(ROOT, "whisper.cpp");

function msToSec(ms: number): number {
  return ms / 1000;
}

function extractWav(videoPath: string, wavPath: string): void {
  const result = spawnSync(
    "ffmpeg",
    ["-y", "-i", videoPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `ffmpeg failed extracting audio from ${videoPath}\n${result.stderr}`,
    );
  }
}

async function ensureWhisperCpp(): Promise<void> {
  console.log(`[whisper] ensuring whisper.cpp ${WHISPER_CPP_VERSION}…`);
  await installWhisperCpp({
    to: WHISPER_DIR,
    version: WHISPER_CPP_VERSION,
    printOutput: true,
  });
  await downloadWhisperModel({
    model: WHISPER_MODEL,
    folder: WHISPER_DIR,
    printOutput: true,
  });
}

export async function runWhisper(options: {
  videoPath: string;
}): Promise<Omit<Transcript, "source">> {
  await ensureWhisperCpp();

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talking-head-whisper-"));
  const wavPath = path.join(tmpDir, "audio.wav");

  try {
    console.log(`[whisper] extracting 16kHz wav…`);
    extractWav(options.videoPath, wavPath);

    console.log(
      `[whisper] transcribing model=${WHISPER_MODEL} language=${WHISPER_LANGUAGE}`,
    );
    const whisperCppOutput = await transcribe({
      inputPath: wavPath,
      whisperPath: WHISPER_DIR,
      whisperCppVersion: WHISPER_CPP_VERSION,
      model: WHISPER_MODEL,
      language: WHISPER_LANGUAGE,
      tokenLevelTimestamps: true,
      splitOnWord: true,
      printOutput: true,
    });

    // With splitOnWord + tokenLevelTimestamps, each transcription item is a word
    // (e.g. "it's"). toCaptions() maps those items — don't walk BPE tokens.
    const { captions } = toCaptions({ whisperCppOutput });

    const words: TranscriptWord[] = captions
      .map((caption) => {
        const word = caption.text.trim();
        const startMs =
          caption.timestampMs != null && caption.timestampMs >= 0
            ? caption.timestampMs
            : caption.startMs;
        const endMs = Math.max(startMs + 40, caption.endMs);
        return {
          word,
          start: msToSec(startMs),
          end: msToSec(endMs),
          probability: caption.confidence ?? null,
        };
      })
      .filter((w) => w.word.length > 0 && !/\[BLANK_AUDIO\]/i.test(w.word));

    // Snap ends so words don't overlap
    for (let i = 0; i < words.length - 1; i++) {
      const current = words[i]!;
      const next = words[i + 1]!;
      if (next.start > current.start) {
        current.end = Math.max(
          current.start + 0.04,
          Math.min(current.end, next.start),
        );
      }
    }

    const duration = Math.max(0, ...words.map((w) => w.end));

    console.log(`[whisper] wrote ${words.length} words`);

    // Remotion's whisper.cpp wrapper leaves tmp.json in the project root
    const leftover = path.join(ROOT, "tmp.json");
    if (fs.existsSync(leftover)) {
      fs.unlinkSync(leftover);
    }

    return {
      language: whisperCppOutput.result.language || WHISPER_LANGUAGE,
      duration,
      words,
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
