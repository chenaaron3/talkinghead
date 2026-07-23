import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { PUBLIC_EPISODES_DIR, SOURCE_DIR } from "./types";

const PREVIEW_NAME = "preview.mp4";

/**
 * Editor playback proxy.
 *
 * A-roll sources are typically 10-bit HEVC iPhone footage with ~1s keyframe
 * intervals. Browsers decode that slowly (often in software), which stalls
 * the Remotion player once per GOP during playback. The proxy is 8-bit H.264
 * with a keyframe every 15 frames: hardware-decodable everywhere and cheap
 * to seek. It is served to the editor only — renders keep the original.
 */

type SourceFingerprint = {
  size: number;
  mtimeMs: number;
};

export function previewProxySrc(episodeId: string): string {
  return `episodes/${episodeId}/${PREVIEW_NAME}`;
}

export function previewProxyPath(episodeId: string): string {
  return path.join(PUBLIC_EPISODES_DIR, episodeId, PREVIEW_NAME);
}

function fingerprintPath(episodeId: string): string {
  return path.join(
    SOURCE_DIR,
    episodeId,
    "generated",
    "preview-proxy.json",
  );
}

function proxyUpToDate(episodeId: string, videoStat: fs.Stats): boolean {
  if (!fs.existsSync(previewProxyPath(episodeId))) return false;
  try {
    const meta = JSON.parse(
      fs.readFileSync(fingerprintPath(episodeId), "utf8"),
    ) as SourceFingerprint;
    return (
      meta.size === videoStat.size &&
      Math.abs(meta.mtimeMs - videoStat.mtimeMs) < 1
    );
  } catch {
    return false;
  }
}

function encodeProxy(videoPath: string, destPath: string): boolean {
  const tmp = `${destPath}.tmp.mp4`;
  // Hardware encoder first (fast on macOS); libx264 as a portable fallback.
  const codecAttempts: string[][] = [
    ["-c:v", "h264_videotoolbox", "-b:v", "8M"],
    ["-c:v", "libx264", "-crf", "20", "-preset", "veryfast"],
  ];
  for (const codec of codecAttempts) {
    const result = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        videoPath,
        ...codec,
        "-pix_fmt",
        "yuv420p",
        "-g",
        "15",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        tmp,
      ],
      { encoding: "utf8" },
    );
    if (result.status === 0) {
      fs.renameSync(tmp, destPath);
      return true;
    }
    try {
      fs.unlinkSync(tmp);
    } catch {
      // no partial output
    }
  }
  return false;
}

/**
 * Ensure the proxy exists and matches the source video.
 * Returns the public src on success, null if encoding failed.
 */
export function ensurePreviewProxy(
  episodeId: string,
  videoPath: string,
): string | null {
  const videoStat = fs.statSync(videoPath);
  if (proxyUpToDate(episodeId, videoStat)) {
    return previewProxySrc(episodeId);
  }

  const destPath = previewProxyPath(episodeId);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  console.log(`[preview] encoding editor proxy → ${previewProxySrc(episodeId)}`);
  if (!encodeProxy(videoPath, destPath)) {
    console.error(
      `[preview] ffmpeg failed — editor will play the original video`,
    );
    return null;
  }

  const meta: SourceFingerprint = {
    size: videoStat.size,
    mtimeMs: videoStat.mtimeMs,
  };
  fs.mkdirSync(path.dirname(fingerprintPath(episodeId)), { recursive: true });
  fs.writeFileSync(
    fingerprintPath(episodeId),
    `${JSON.stringify(meta, null, 2)}\n`,
    "utf8",
  );
  return previewProxySrc(episodeId);
}
