import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { COMPOSITION_HEIGHT, COMPOSITION_WIDTH } from "../../src/lib/episode/constants";
import { PUBLIC_VFX_DIR } from "../../cli/helpers/types";
import { probeMedia } from "./broll-media";

const NOMINATIM_UA =
  "talking-head-editor/1.0 (local video editor; location VFX)";
/** Neighborhood-scale zoom with pin at exact coords. */
const LOCATION_MAP_ZOOM = 16;
/** Tile grid before crop/scale (covers ~ neighborhood). */
const TILE_COLS = 3;
const TILE_ROWS = 5;
const TILE_SIZE = 256;

export type GeocodeSuggestion = {
  placeId: string;
  label: string;
  lat: number;
  lon: number;
};

export type BakedLocationMap = {
  key: string;
  label: string;
  type: "location";
  src: string;
  thumbUrl: string;
  width: number;
  height: number;
};

function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "location";
}

function latLonToTileFrac(
  lat: number,
  lon: number,
  zoom: number,
): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y =
    ((1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2) *
    n;
  return { x, y };
}

export async function searchPlaces(
  query: string,
): Promise<GeocodeSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "0");
  url.searchParams.set("limit", "6");

  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": NOMINATIM_UA,
    },
  });
  if (!res.ok) {
    throw new Error(`Geocode failed (${res.status})`);
  }

  const data = (await res.json()) as Array<{
    place_id?: number | string;
    display_name?: string;
    lat?: string;
    lon?: string;
  }>;

  return data
    .map((row) => {
      const lat = Number(row.lat);
      const lon = Number(row.lon);
      const label = String(row.display_name ?? "").trim();
      if (!label || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      return {
        placeId: String(row.place_id ?? `${lat},${lon}`),
        label,
        lat,
        lon,
      } satisfies GeocodeSuggestion;
    })
    .filter((row): row is GeocodeSuggestion => row != null);
}

async function fetchTile(z: number, x: number, y: number): Promise<Buffer> {
  const n = 2 ** z;
  const tx = ((x % n) + n) % n;
  const ty = Math.min(n - 1, Math.max(0, y));
  const url = `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
  const res = await fetch(url, {
    headers: { "User-Agent": NOMINATIM_UA },
  });
  if (!res.ok) {
    throw new Error(`Tile fetch failed (${res.status}) for ${z}/${tx}/${ty}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function runFfmpeg(args: string[]): void {
  const result = spawnSync("ffmpeg", ["-y", ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `ffmpeg failed: ${result.stderr || result.stdout || "unknown"}`,
    );
  }
}

/**
 * Download a neighborhood tile mosaic centered on lat/lon, crop to 9:16,
 * scale to composition size, and draw a red pin at the exact location.
 */
async function bakeMapImage(
  lat: number,
  lon: number,
  destAbs: string,
): Promise<void> {
  const { x: fx, y: fy } = latLonToTileFrac(lat, lon, LOCATION_MAP_ZOOM);
  const centerTx = Math.floor(fx);
  const centerTy = Math.floor(fy);
  const originTx = centerTx - Math.floor(TILE_COLS / 2);
  const originTy = centerTy - Math.floor(TILE_ROWS / 2);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "vfx-map-"));
  try {
    const tilePaths: string[] = [];
    for (let row = 0; row < TILE_ROWS; row++) {
      for (let col = 0; col < TILE_COLS; col++) {
        const buf = await fetchTile(
          LOCATION_MAP_ZOOM,
          originTx + col,
          originTy + row,
        );
        const tilePath = path.join(tmpDir, `t-${row}-${col}.png`);
        fs.writeFileSync(tilePath, buf);
        tilePaths.push(tilePath);
      }
    }

    const mosaicAbs = path.join(tmpDir, "mosaic.png");
    // Build rows with hstack, then vstack rows.
    const rowPaths: string[] = [];
    for (let row = 0; row < TILE_ROWS; row++) {
      const rowAbs = path.join(tmpDir, `row-${row}.png`);
      const inputs = tilePaths.slice(row * TILE_COLS, row * TILE_COLS + TILE_COLS);
      const filter =
        inputs.map((_, i) => `[${i}:v]`).join("") +
        `hstack=inputs=${TILE_COLS}[v]`;
      runFfmpeg([
        ...inputs.flatMap((p) => ["-i", p]),
        "-filter_complex",
        filter,
        "-map",
        "[v]",
        rowAbs,
      ]);
      rowPaths.push(rowAbs);
    }

    runFfmpeg([
      ...rowPaths.flatMap((p) => ["-i", p]),
      "-filter_complex",
      rowPaths.map((_, i) => `[${i}:v]`).join("") +
        `vstack=inputs=${TILE_ROWS}[v]`,
      "-map",
      "[v]",
      mosaicAbs,
    ]);

    const mosaicW = TILE_COLS * TILE_SIZE;
    const mosaicH = TILE_ROWS * TILE_SIZE;
    const pinX = (fx - originTx) * TILE_SIZE;
    const pinY = (fy - originTy) * TILE_SIZE;

    // Crop centered 9:16 region around the pin, then scale + draw pin.
    const targetAspect = COMPOSITION_WIDTH / COMPOSITION_HEIGHT;
    let cropW = mosaicW;
    let cropH = Math.round(cropW / targetAspect);
    if (cropH > mosaicH) {
      cropH = mosaicH;
      cropW = Math.round(cropH * targetAspect);
    }
    const cropX = Math.min(
      mosaicW - cropW,
      Math.max(0, Math.round(pinX - cropW / 2)),
    );
    const cropY = Math.min(
      mosaicH - cropH,
      Math.max(0, Math.round(pinY - cropH / 2)),
    );
    const pinInCropX = pinX - cropX;
    const pinInCropY = pinY - cropY;
    const scale = COMPOSITION_WIDTH / cropW;
    const pinFinalX = Math.round(pinInCropX * scale);
    const pinFinalY = Math.round(pinInCropY * scale);

    const pinR = 18;
    const pinOuter = 22;
    runFfmpeg([
      "-i",
      mosaicAbs,
      "-vf",
      [
        `crop=${cropW}:${cropH}:${cropX}:${cropY}`,
        `scale=${COMPOSITION_WIDTH}:${COMPOSITION_HEIGHT}`,
        // Soft white halo + red pin head + white center
        `drawbox=x=${pinFinalX - pinOuter}:y=${pinFinalY - pinOuter}:w=${pinOuter * 2}:h=${pinOuter * 2}:color=white@0.85:t=fill`,
        `drawbox=x=${pinFinalX - pinR}:y=${pinFinalY - pinR}:w=${pinR * 2}:h=${pinR * 2}:color=0xe11d48@1:t=fill`,
        `drawbox=x=${pinFinalX - 6}:y=${pinFinalY - 6}:w=12:h=12:color=white@1:t=fill`,
      ].join(","),
      destAbs,
    ]);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export async function bakeLocationMap(options: {
  episodeId: string;
  label: string;
  lat: number;
  lon: number;
}): Promise<BakedLocationMap> {
  const { episodeId, label, lat, lon } = options;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("Invalid coordinates");
  }

  const dir = path.join(PUBLIC_VFX_DIR, episodeId);
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "")
    .replace("T", "-")
    .slice(0, 15);
  const filename = `location-${slugify(label)}-${stamp}.png`;
  const absFinal = path.join(dir, filename);

  await bakeMapImage(lat, lon, absFinal);

  const probe = probeMedia(absFinal);
  const width = probe.width ?? COMPOSITION_WIDTH;
  const height = probe.height ?? COMPOSITION_HEIGHT;
  const publicSrc = path
    .join("vfx", episodeId, filename)
    .split(path.sep)
    .join("/");

  return {
    key: `${episodeId}/${filename}`,
    label: label.split(",")[0]?.trim() || label,
    type: "location",
    src: publicSrc,
    thumbUrl: `/${publicSrc}`,
    width,
    height,
  };
}

export function listEpisodeVfxAssets(episodeId: string): BakedLocationMap[] {
  const dir = path.join(PUBLIC_VFX_DIR, episodeId);
  if (!fs.existsSync(dir)) return [];

  const out: BakedLocationMap[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const ext = path.extname(name).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) continue;
    const abs = path.join(dir, name);
    if (!fs.statSync(abs).isFile()) continue;
    try {
      const probe = probeMedia(abs);
      const publicSrc = path
        .join("vfx", episodeId, name)
        .split(path.sep)
        .join("/");
      out.push({
        key: `${episodeId}/${name}`,
        label: name.replace(/\.[^.]+$/, "").replace(/^location-/, ""),
        type: "location",
        src: publicSrc,
        thumbUrl: `/${publicSrc}`,
        width: probe.width ?? COMPOSITION_WIDTH,
        height: probe.height ?? COMPOSITION_HEIGHT,
      });
    } catch {
      // skip unreadable
    }
  }
  return out;
}

export function deleteVfxAsset(episodeId: string, key: string): string | null {
  const expectedPrefix = `${episodeId}/`;
  if (!key.startsWith(expectedPrefix)) return null;
  const rel = key.slice(expectedPrefix.length);
  if (!rel || rel.includes("..") || path.isAbsolute(rel)) return null;

  const abs = path.join(PUBLIC_VFX_DIR, episodeId, rel);
  const publicRoot = path.join(PUBLIC_VFX_DIR, episodeId);
  if (!abs.startsWith(publicRoot + path.sep) && abs !== publicRoot) return null;
  if (!fs.existsSync(abs)) return null;

  fs.unlinkSync(abs);
  return path.join("vfx", episodeId, rel).split(path.sep).join("/");
}

/** VFX files are baked into public/vfx; nothing to link from source. */
export function ensureVfxAssets(_clips: SourceVfxLike[]): void {
  // no-op
}

type SourceVfxLike = { type?: string; src?: string };
