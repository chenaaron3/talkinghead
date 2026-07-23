import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export type MediaProbe = {
  /** Present for image / video. */
  width?: number;
  height?: number;
  durationSec: number;
};

/**
 * One ffprobe for image, video, and audio.
 * Visual streams contribute width/height; audio-only gets duration.
 */
export function probeMedia(absPath: string): MediaProbe {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "stream=width,height:format=duration",
      "-of",
      "json",
      absPath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`ffprobe failed for ${absPath}: ${result.stderr}`);
  }

  const parsed = JSON.parse(result.stdout) as {
    streams?: Array<{
      width?: number;
      height?: number;
    }>;
    format?: { duration?: string };
  };

  const visual = parsed.streams?.find(
    (s) => (s.width ?? 0) > 0 && (s.height ?? 0) > 0,
  );

  const duration = Number(parsed.format?.duration);
  return {
    ...(visual ? { width: visual.width, height: visual.height } : {}),
    durationSec: Number.isFinite(duration) && duration > 0 ? duration : 0.5,
  };
}

/** Decoded frame size (ffmpeg applies EXIF / container rotation). */
function decodedSize(absPath: string): { width: number; height: number } {
  const result = spawnSync(
    "ffmpeg",
    ["-i", absPath, "-frames:v", "1", "-f", "null", "-"],
    { encoding: "utf8" },
  );
  const text = `${result.stderr}\n${result.stdout}`;
  const section = text.includes("Output #")
    ? text.slice(text.indexOf("Output #"))
    : text;
  const match = section.match(/\b(\d{2,5})x(\d{2,5})\b/);
  if (!match) {
    throw new Error(`Could not determine display size for ${absPath}`);
  }
  return { width: Number(match[1]), height: Number(match[2]) };
}

function replaceWithFfmpeg(absPath: string, ffmpegArgs: string[]): void {
  const ext = path.extname(absPath) || ".bin";
  const tmp = `${absPath}.norm${ext}`;
  const result = spawnSync("ffmpeg", ["-y", ...ffmpegArgs, tmp], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
    throw new Error(`ffmpeg failed for ${absPath}: ${result.stderr}`);
  }
  fs.renameSync(tmp, absPath);
}

/**
 * True when container/EXIF orientation means coded size ≠ display size
 * (typical iPhone portrait MOV with rotation=-90).
 */
export function hasDisplayOrientation(absPath: string): boolean {
  const probe = probeMedia(absPath);
  if (probe.width == null || probe.height == null) return false;
  const decoded = decodedSize(absPath);
  return probe.width !== decoded.width || probe.height !== decoded.height;
}

/**
 * Write an upright H.264 copy with rotation baked into pixels.
 * ffmpeg autorotates on encode so Remotion and cloud cutout see the same frame.
 */
export function writeUprightVideoCopy(
  srcPath: string,
  destPath: string,
  options?: { audio?: boolean },
): void {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const withAudio = options?.audio === true;
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      srcPath,
      "-c:v",
      "libx264",
      "-crf",
      "18",
      "-preset",
      "veryfast",
      ...(withAudio
        ? (["-c:a", "aac", "-b:a", "192k"] as const)
        : (["-an"] as const)),
      "-movflags",
      "+faststart",
      destPath,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    try {
      fs.unlinkSync(destPath);
    } catch {
      // ignore
    }
    throw new Error(
      `ffmpeg upright copy failed for ${srcPath}: ${result.stderr}`,
    );
  }
}

/**
 * Bake display orientation into pixels when coded size ≠ decoded size.
 * ffmpeg autorotate applies EXIF (images) and container rotation (video).
 * Remotion then sees upright pixels whose width/height match the layout box.
 */
export function normalizeBRollMedia(absPath: string, isVideo: boolean): void {
  const probe = probeMedia(absPath);
  if (probe.width == null || probe.height == null) {
    throw new Error(`No visual stream for ${absPath}`);
  }
  const decoded = decodedSize(absPath);
  if (probe.width === decoded.width && probe.height === decoded.height) {
    return;
  }

  if (isVideo) {
    replaceWithFfmpeg(absPath, [
      "-i",
      absPath,
      "-c:v",
      "libx264",
      "-crf",
      "20",
      "-preset",
      "veryfast",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
    ]);
    return;
  }

  replaceWithFfmpeg(absPath, ["-i", absPath, "-q:v", "2"]);
}
