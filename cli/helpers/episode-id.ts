import fs from "node:fs";
import path from "node:path";
import { writeEpisodeConfig } from "./config";
import { SOURCE_DIR, VIDEO_EXTENSIONS } from "./types";

/** Local wall-clock stamp: YYYYMMDD-HHMMSS */
export function formatEpisodeTimestamp(date: Date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .slice(0, 15);
}

export function sanitizeEpisodeBasename(filename: string): string {
  return path
    .basename(filename, path.extname(filename))
    .replace(/[^a-zA-Z0-9-]/g, "-");
}

export function episodeIdFromFilename(
  filename: string,
  date: Date = new Date(),
): string {
  return `${formatEpisodeTimestamp(date)}-${sanitizeEpisodeBasename(filename)}`;
}

export function isVideoFilename(filename: string): boolean {
  const ext = path.extname(filename);
  return VIDEO_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext.toLowerCase());
}

/** Create `source/<episodeId>/` and write the video bytes into it. */
export function createEpisodeWithVideo(opts: {
  filename: string;
  data: Buffer;
}): { episodeId: string; episodeDir: string; videoPath: string } {
  const { filename, data } = opts;
  if (!isVideoFilename(filename)) {
    throw new Error(
      `Unsupported video type: ${path.extname(filename) || "(none)"}. Use .mp4 / .mov / .webm.`,
    );
  }

  const safeName = path.basename(filename).replace(/[/\\]/g, "");
  const episodeId = episodeIdFromFilename(safeName);
  const episodeDir = path.join(SOURCE_DIR, episodeId);
  fs.mkdirSync(episodeDir, { recursive: true });
  const videoPath = path.join(episodeDir, safeName);
  fs.writeFileSync(videoPath, data);
  writeEpisodeConfig(episodeDir, { aroll: safeName });
  return { episodeId, episodeDir, videoPath };
}

/** Move an existing video file into a new episode folder (bulk claim). */
export function claimVideoIntoEpisode(absFrom: string): {
  episodeId: string;
  episodeDir: string;
} {
  const filename = path.basename(absFrom);
  if (!isVideoFilename(filename)) {
    throw new Error(`Unsupported video type: ${filename}`);
  }
  const episodeId = episodeIdFromFilename(filename);
  const episodeDir = path.join(SOURCE_DIR, episodeId);
  fs.mkdirSync(episodeDir, { recursive: true });
  const to = path.join(episodeDir, filename);
  fs.renameSync(absFrom, to);
  writeEpisodeConfig(episodeDir, { aroll: filename });
  return { episodeId, episodeDir };
}

/** Avoid clobbering: photo.jpg → photo-1.jpg → photo-2.jpg … */
export function uniqueFilenameInDir(dir: string, filename: string): string {
  const safeName = path.basename(filename).replace(/[/\\]/g, "");
  const ext = path.extname(safeName);
  const stem = path.basename(safeName, ext);
  let candidate = safeName;
  let n = 1;
  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${stem}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}
