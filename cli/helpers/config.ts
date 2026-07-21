import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import {
  DEFAULT_CAPTIONS_AT_A_TIME,
  DEFAULT_TITLE_DURATION_SEC,
} from "./constants";
import {
  DEFAULT_CONFIG_PATH,
  type EpisodeConfig,
  type SourceBRoll,
  type SourceListicle,
  type SourceMusic,
  type SourcePunchIn,
  type SourceSfx,
  type SourceVfx,
  type SourceCut,
  SOURCE_DIR,
} from "./types";
import { isVideoSrc } from "../../src/lib/media";
import { isVfxType } from "../../src/lib/config-types";
import { DEFAULT_PUNCH_IN_SCALE } from "../../src/lib/punchin";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Record<string, unknown>,
): T {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

function readYaml(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = YAML.parse(raw);
  if (parsed == null) return {};
  if (!isPlainObject(parsed)) {
    throw new Error(`Config must be a YAML object: ${filePath}`);
  }
  return parsed;
}

function writeYaml(filePath: string, data: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${YAML.stringify(data)}\n`, "utf8");
}

export function resolveEpisodeDir(input: string): {
  episodeId: string;
  episodeDir: string;
} {
  const resolved = path.resolve(input);
  const episodeId = path.basename(resolved);
  const underSource = path.join(SOURCE_DIR, episodeId);

  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    return { episodeId, episodeDir: resolved };
  }
  if (fs.existsSync(underSource) && fs.statSync(underSource).isDirectory()) {
    return { episodeId, episodeDir: underSource };
  }
  throw new Error(
    `Episode directory not found: ${input}\nExpected something like source/${episodeId}`,
  );
}

/** Absolute path to the A-roll file named by `config.aroll`. */
export function findSourceVideo(episodeDir: string, aroll: string): string {
  const filename = path.basename(aroll.trim());
  if (!filename) {
    throw new Error(`Missing "aroll" filename for episode ${episodeDir}`);
  }
  const abs = path.join(episodeDir, filename);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
    throw new Error(
      `A-roll not found: ${filename} in ${episodeDir} (config.aroll)`,
    );
  }
  return abs;
}

function parseCuts(value: unknown, configPath: string): SourceCut[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`"cuts" must be a list in ${configPath}`);
  }
  return value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(`"cuts[${index}]" must be an object in ${configPath}`);
    }
    const start = Number(entry.start);
    const end = Number(entry.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error(
        `"cuts[${index}]" needs valid start/end in ${configPath}`,
      );
    }
    return { start, end };
  });
}

function parseListicleOverlay(
  value: unknown,
  configPath: string,
): SourceListicle | null {
  if (value == null) return null;
  if (!isPlainObject(value)) {
    throw new Error(`"listicleOverlay" must be an object in ${configPath}`);
  }
  const start = Number(value.start);
  const end = Number(value.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error(`"listicleOverlay" needs valid start/end in ${configPath}`);
  }
  const itemsRaw = value.items;
  if (!Array.isArray(itemsRaw)) {
    throw new Error(`"listicleOverlay.items" must be a list in ${configPath}`);
  }
  const items = itemsRaw.map((item, i) => {
    if (!isPlainObject(item)) {
      throw new Error(
        `"listicleOverlay.items[${i}]" must be an object in ${configPath}`,
      );
    }
    const label = String(item.label ?? "").trim();
    const reveal = Number(item.reveal);
    if (!label || !Number.isFinite(reveal)) {
      throw new Error(
        `"listicleOverlay.items[${i}]" needs label + reveal in ${configPath}`,
      );
    }
    return { label, reveal };
  });
  return { start, end, items };
}

function parsePunchInSegments(
  value: unknown,
  configPath: string,
): SourcePunchIn[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`"punchInSegments" must be a list in ${configPath}`);
  }
  return value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(
        `"punchInSegments[${index}]" must be an object in ${configPath}`,
      );
    }
    const start = Number(entry.start);
    const end = Number(entry.end);
    const scale = Number(entry.scale ?? DEFAULT_PUNCH_IN_SCALE);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new Error(
        `"punchInSegments[${index}]" needs valid start/end in ${configPath}`,
      );
    }
    if (!Number.isFinite(scale) || scale <= 0) {
      throw new Error(
        `"punchInSegments[${index}]" needs a positive scale in ${configPath}`,
      );
    }
    const originX = Number(entry.originX);
    const originY = Number(entry.originY);
    const punchIn: SourcePunchIn = {
      start,
      end,
      scale,
      ...(typeof entry.wordByWord === "boolean"
        ? { wordByWord: entry.wordByWord }
        : {}),
      ...(typeof entry.animate === "boolean"
        ? { animate: entry.animate }
        : {}),
    };
    if (entry.originX != null && Number.isFinite(originX)) {
      punchIn.originX = Math.min(1, Math.max(0, originX));
    }
    if (entry.originY != null && Number.isFinite(originY)) {
      punchIn.originY = Math.min(1, Math.max(0, originY));
    }
    return punchIn;
  });
}

function parseBRolls(value: unknown, configPath: string): SourceBRoll[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`"bRolls" must be a list in ${configPath}`);
  }
  return value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(`"bRolls[${index}]" must be an object in ${configPath}`);
    }
    const id = String(entry.id ?? "").trim();
    const src = String(entry.src ?? "").trim();
    const start = Number(entry.start);
    const end = Number(entry.end);
    if (!id || !src || !Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error(
        `"bRolls[${index}]" needs id, src, start, end in ${configPath}`,
      );
    }
    const width = Number(entry.width);
    const height = Number(entry.height);
    if (
      !Number.isFinite(width) ||
      width <= 0 ||
      !Number.isFinite(height) ||
      height <= 0
    ) {
      throw new Error(
        `"bRolls[${index}]" needs positive width and height in ${configPath}`,
      );
    }
    const scale = Number(entry.scale);
    const offsetX = Number(entry.offsetX);
    const offsetY = Number(entry.offsetY);
    const rotation = Number(entry.rotation);
    const srcDurationSec = Number(entry.srcDurationSec);
    const mediaOffsetSec = Number(entry.mediaOffsetSec);
    const volume = Number(entry.volume);
    const kenBurns = Number(entry.kenBurns);

    const isVideo = isVideoSrc(src);
    let clip: SourceBRoll;
    if (isVideo) {
      if (
        entry.srcDurationSec == null ||
        !Number.isFinite(srcDurationSec) ||
        srcDurationSec <= 0
      ) {
        throw new Error(
          `"bRolls[${index}]" video needs positive srcDurationSec in ${configPath}`,
        );
      }
      clip = { id, src, start, end, width, height, srcDurationSec };
    } else {
      clip = { id, src, start, end, width, height };
    }

    if (entry.scale != null && Number.isFinite(scale)) clip.scale = scale;
    if (entry.offsetX != null && Number.isFinite(offsetX)) clip.offsetX = offsetX;
    if (entry.offsetY != null && Number.isFinite(offsetY)) clip.offsetY = offsetY;
    if (entry.rotation != null && Number.isFinite(rotation)) {
      clip.rotation = rotation;
    }
    if (
      entry.mediaOffsetSec != null &&
      Number.isFinite(mediaOffsetSec) &&
      mediaOffsetSec > 0
    ) {
      clip.mediaOffsetSec = mediaOffsetSec;
    }
    if (entry.volume != null && Number.isFinite(volume)) {
      clip.volume = Math.min(1, Math.max(0, volume));
    }
    if (entry.kenBurns != null && Number.isFinite(kenBurns) && kenBurns > 0) {
      clip.kenBurns = kenBurns;
    }
    return clip;
  });
}

function parseVfx(value: unknown, configPath: string): SourceVfx[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`"vfx" must be a list in ${configPath}`);
  }
  return value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(`"vfx[${index}]" must be an object in ${configPath}`);
    }
    const id = String(entry.id ?? "").trim();
    const start = Number(entry.start);
    const end = Number(entry.end);
    if (!id || !Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error(
        `"vfx[${index}]" needs id, start, end in ${configPath}`,
      );
    }
    if (!isVfxType(entry.type)) {
      throw new Error(
        `"vfx[${index}]" needs type (location | shake) in ${configPath}`,
      );
    }

    if (entry.type === "shake") {
      const clip: SourceVfx = { id, type: "shake", start, end };
      const intensity = Number(entry.intensity);
      if (entry.intensity != null && Number.isFinite(intensity) && intensity > 0) {
        clip.intensity = intensity;
      }
      return clip;
    }

    const src = String(entry.src ?? "").trim();
    const label = String(entry.label ?? "").trim();
    const width = Number(entry.width);
    const height = Number(entry.height);

    if (src) {
      if (
        !Number.isFinite(width) ||
        width <= 0 ||
        !Number.isFinite(height) ||
        height <= 0
      ) {
        throw new Error(
          `"vfx[${index}]" with src needs positive width and height in ${configPath}`,
        );
      }
    }

    const scale = Number(entry.scale);
    const offsetX = Number(entry.offsetX);
    const offsetY = Number(entry.offsetY);
    const rotation = Number(entry.rotation);

    const clip: SourceVfx = { id, type: "location", start, end };
    if (label) clip.label = label;
    if (src) {
      clip.src = src;
      clip.width = width;
      clip.height = height;
    }
    if (entry.scale != null && Number.isFinite(scale)) clip.scale = scale;
    if (entry.offsetX != null && Number.isFinite(offsetX)) clip.offsetX = offsetX;
    if (entry.offsetY != null && Number.isFinite(offsetY)) clip.offsetY = offsetY;
    if (entry.rotation != null && Number.isFinite(rotation)) {
      clip.rotation = rotation;
    }
    return clip;
  });
}

function parseSfx(value: unknown, configPath: string): SourceSfx[] {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`"sfx" must be a list in ${configPath}`);
  }
  return value.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(`"sfx[${index}]" must be an object in ${configPath}`);
    }
    const id = String(entry.id ?? "").trim();
    const src = String(entry.src ?? "").trim();
    const start = Number(entry.start);
    const end = Number(entry.end);
    if (!id || !src || !Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error(
        `"sfx[${index}]" needs id, src, start, end in ${configPath}`,
      );
    }
    const srcDurationSec = Number(entry.srcDurationSec);
    const volume = Number(entry.volume);
    const clip: SourceSfx = {
      id,
      src,
      start,
      end,
      srcDurationSec:
        Number.isFinite(srcDurationSec) && srcDurationSec > 0
          ? srcDurationSec
          : Math.max(end - start, 0.04),
    };
    if (entry.volume != null && Number.isFinite(volume)) {
      clip.volume = Math.min(1, Math.max(0, volume));
    }
    return clip;
  });
}

function parseMusic(
  value: unknown,
  configPath: string,
): SourceMusic | null {
  if (value == null) return null;
  if (!isPlainObject(value)) {
    throw new Error(`"music" must be an object or null in ${configPath}`);
  }
  const id = String(value.id ?? "").trim();
  const src = String(value.src ?? "").trim();
  if (!id || !src) {
    throw new Error(`"music" needs id and src in ${configPath}`);
  }
  const srcDurationSec = Number(value.srcDurationSec);
  const volume = Number(value.volume);
  const mediaOffsetSec = Number(value.mediaOffsetSec);
  const clip: SourceMusic = {
    id,
    src,
    srcDurationSec:
      Number.isFinite(srcDurationSec) && srcDurationSec > 0
        ? srcDurationSec
        : 1,
  };
  if (value.volume != null && Number.isFinite(volume)) {
    clip.volume = Math.min(1, Math.max(0, volume));
  }
  if (
    value.mediaOffsetSec != null &&
    Number.isFinite(mediaOffsetSec) &&
    mediaOffsetSec > 0
  ) {
    clip.mediaOffsetSec = mediaOffsetSec;
  }
  return clip;
}

export function loadEpisodeConfig(episodeDir: string): EpisodeConfig {
  const configPath = path.join(episodeDir, "config.yaml");
  const defaults = readYaml(DEFAULT_CONFIG_PATH);
  const local = readYaml(configPath);
  const merged = deepMerge(defaults, local);

  const titleRaw = String(merged.title ?? "").trim();
  const title = titleRaw.length > 0 ? titleRaw : null;
  const aroll = path.basename(String(merged.aroll ?? "").trim());
  if (!aroll) {
    throw new Error(`Missing required "aroll" in ${configPath}`);
  }

  return {
    aroll,
    title,
    captionsAtATime: Math.max(
      1,
      Number(merged.captionsAtATime ?? DEFAULT_CAPTIONS_AT_A_TIME),
    ),
    titleDurationSec: Number(
      merged.titleDurationSec ?? DEFAULT_TITLE_DURATION_SEC,
    ),
    listicle: Boolean(merged.listicle ?? false),
    punchIns: Boolean(merged.punchIns ?? false),
    emphasis: Boolean(merged.emphasis ?? false),
    cuts: parseCuts(local.cuts, configPath),
    listicleOverlay: parseListicleOverlay(local.listicleOverlay, configPath),
    punchInSegments: parsePunchInSegments(local.punchInSegments, configPath),
    bRolls: parseBRolls(local.bRolls, configPath),
    vfx: parseVfx(local.vfx, configPath),
    sfx: parseSfx(local.sfx, configPath),
    music: parseMusic(local.music, configPath),
  };
}

/** Merge fields into episode config.yaml (creates the file if missing). */
export function writeEpisodeConfig(
  episodeDir: string,
  patch: Record<string, unknown>,
): void {
  const configPath = path.join(episodeDir, "config.yaml");
  const existing = readYaml(configPath);
  writeYaml(configPath, { ...existing, ...patch });
}

/** Merge `title` into episode config.yaml (creates the file if missing). */
export function writeEpisodeTitle(episodeDir: string, title: string): void {
  writeEpisodeConfig(episodeDir, { title });
}

export function listProcessedEpisodes(): string[] {
  if (!fs.existsSync(SOURCE_DIR)) return [];
  return fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "_bulk")
    .filter((name) =>
      fs.existsSync(path.join(SOURCE_DIR, name, "generated", "props.json")),
    )
    .sort();
}
