import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fal } from "@fal-ai/client";

import {
  hasDisplayOrientation,
  probeMedia,
  writeUprightVideoCopy,
} from "../../editor/server/broll-media";
import {
  arollBgSrcForCutout,
  arollDisplaySrcForCutout,
} from "../../src/lib/episode/config-types";
import { PUBLIC_EPISODES_DIR, ROOT } from "../helpers/types";
import type { SourceCutout } from "../helpers/types";

const BRIA_MODEL = "bria/video/background-removal/v3";

export type CutoutBakeResult = {
  cutout: SourceCutout;
  reused: boolean;
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function mimeForExt(ext: string): string {
  const lower = ext.toLowerCase();
  if (lower === ".webm") return "video/webm";
  if (lower === ".mov") return "video/quicktime";
  if (lower === ".mp4" || lower === ".m4v") return "video/mp4";
  return "application/octet-stream";
}

function cutoutCacheValid(
  existing: SourceCutout | null | undefined,
  videoStat: fs.Stats,
  personPath: string,
  bgPath: string,
): existing is SourceCutout {
  if (!existing) return false;
  if (!fs.existsSync(personPath) || !fs.existsSync(bgPath)) return false;
  return (
    existing.source.size === videoStat.size &&
    Math.abs(existing.source.mtimeMs - videoStat.mtimeMs) < 1
  );
}

function formatFalError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : String(error);
  }
  const err = error as {
    message?: string;
    status?: number;
    body?: unknown;
  };
  const parts = [
    err.message,
    err.status != null ? `status=${err.status}` : null,
  ].filter(Boolean);
  if (err.body != null) {
    const body =
      typeof err.body === "string" ? err.body : JSON.stringify(err.body);
    parts.push(body.slice(0, 400));
  }
  return parts.join(" — ") || "unknown fal error";
}

async function downloadToFile(url: string, destPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `Failed to download cutout (${res.status} ${res.statusText})`,
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  ensureDir(path.dirname(destPath));
  const tmp = `${destPath}.tmp`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, destPath);
}

type AlphamergeMode = "person" | "background";

/**
 * Merge upright A-roll RGB with Bria alpha.
 * - person: keep subject, transparent elsewhere
 * - background: punch subject out (inverse alpha), keep room + mux A-roll audio
 *
 * Bria VP9+alpha must be decoded with libvpx or the alpha plane is dropped.
 */
function alphamergePlate(
  rgbPath: string,
  briaPath: string,
  destPath: string,
  mode: AlphamergeMode,
): void {
  ensureDir(path.dirname(destPath));
  const tmp = `${destPath}.tmp.webm`;
  const alphaFilter =
    mode === "person"
      ? "[1:v]format=rgba,alphaextract,format=gray[a]"
      : "[1:v]format=rgba,alphaextract,format=gray,negate[a]";
  const audioArgs =
    mode === "background"
      ? (["-map", "0:a?", "-c:a", "libopus", "-b:a", "128k"] as const)
      : (["-an"] as const);
  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-i",
      rgbPath,
      "-c:v",
      "libvpx-vp9",
      "-i",
      briaPath,
      "-filter_complex",
      `${alphaFilter};[0:v]format=yuv420p[rgb];[rgb][a]alphamerge,format=yuva420p[vout]`,
      "-map",
      "[vout]",
      ...audioArgs,
      "-c:v",
      "libvpx-vp9",
      "-pix_fmt",
      "yuva420p",
      "-auto-alt-ref",
      "0",
      tmp,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore
    }
    throw new Error(
      `ffmpeg alphamerge (${mode}) failed: ${result.stderr.slice(-800)}`,
    );
  }
  fs.renameSync(tmp, destPath);
}

/**
 * Bake sandwich assets via fal + Bria:
 * - `aroll-display.mp4` — opaque upright RGB (+ audio), bake intermediate
 * - `aroll-bg.webm` — room with person punched out (Remotion underlay / videoSrc)
 * - `cutout.webm` — person plate with alpha
 *
 * Skips when person + bg match the A-roll fingerprint. Delete them to regenerate.
 */
export async function bakeCutout(options: {
  episodeId: string;
  videoPath: string;
  existing: SourceCutout | null;
}): Promise<CutoutBakeResult> {
  const { episodeId, videoPath, existing } = options;
  const videoStat = fs.statSync(videoPath);
  const publicSrc = `episodes/${episodeId}/cutout.webm`;
  const publicDisplaySrc = arollDisplaySrcForCutout(publicSrc);
  const publicBgSrc = arollBgSrcForCutout(publicSrc);
  const personPath = path.join(PUBLIC_EPISODES_DIR, episodeId, "cutout.webm");
  const displayPath = path.join(ROOT, "public", publicDisplaySrc);
  const bgPath = path.join(ROOT, "public", publicBgSrc);

  if (cutoutCacheValid(existing, videoStat, personPath, bgPath)) {
    console.log(`[cutout] reusing ${publicSrc} + ${publicBgSrc}`);
    return { cutout: existing, reused: true };
  }

  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    throw new Error(
      "--cutout requires FAL_KEY (set it in .env or the environment)",
    );
  }

  fal.config({ credentials: apiKey });

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cutout-"));
  try {
    ensureDir(path.dirname(displayPath));
    console.log(`[cutout] writing upright display A-roll…`);
    writeUprightVideoCopy(videoPath, displayPath, { audio: true });
    if (hasDisplayOrientation(videoPath)) {
      console.log(`[cutout] (baked container rotation into pixels)`);
    }

    const uploadPath = path.join(tmpDir, "upload.mp4");
    writeUprightVideoCopy(videoPath, uploadPath, { audio: false });

    console.log(`[cutout] uploading ${path.basename(uploadPath)} to fal…`);
    const bytes = fs.readFileSync(uploadPath);
    const file = new File(
      [new Uint8Array(bytes)],
      path.basename(uploadPath),
      { type: mimeForExt(path.extname(uploadPath)) },
    );

    let videoUrl: string;
    try {
      videoUrl = await fal.storage.upload(file);
    } catch (error) {
      throw new Error(`fal upload failed: ${formatFalError(error)}`);
    }

    console.log(`[cutout] running Bria background removal…`);
    let result: { data: unknown };
    try {
      result = await fal.subscribe(BRIA_MODEL, {
        input: {
          video_url: videoUrl,
          background_color: "Transparent",
          output_container_and_codec: "webm_vp9",
          preserve_audio: false,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS" && update.logs?.length) {
            for (const log of update.logs) {
              console.log(`[cutout] ${log.message}`);
            }
          }
        },
      });
    } catch (error) {
      throw new Error(`Bria cutout failed: ${formatFalError(error)}`);
    }

    const data = result.data as {
      video?: { url?: string } | null;
    };
    const outUrl = data.video?.url;
    if (!outUrl) {
      throw new Error("Bria cutout response missing video.url");
    }

    const briaPath = path.join(tmpDir, "bria.webm");
    console.log(`[cutout] downloading Bria matte…`);
    await downloadToFile(outUrl, briaPath);

    console.log(`[cutout] person plate → ${publicSrc}`);
    alphamergePlate(displayPath, briaPath, personPath, "person");
    console.log(`[cutout] room plate (person punched out) → ${publicBgSrc}`);
    alphamergePlate(displayPath, briaPath, bgPath, "background");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const probe = probeMedia(personPath);
  if (!(probe.width && probe.height)) {
    throw new Error(`Cutout probe missing dimensions: ${personPath}`);
  }

  const cutout: SourceCutout = {
    src: publicSrc,
    width: probe.width,
    height: probe.height,
    srcDurationSec: probe.durationSec,
    source: {
      size: videoStat.size,
      mtimeMs: videoStat.mtimeMs,
    },
  };

  return { cutout, reused: false };
}
