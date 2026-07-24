import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

import { normalizeCaptionOverrides } from "../../src/lib/captions/parse-style";
import {
  DEFAULT_QUOTE_TEMPLATE_ID,
  isQuoteTemplateId,
} from "../../src/lib/captions/quote-templates";
import {
  DEFAULT_CAPTION_TEMPLATE_ID,
  isCaptionTemplateId,
} from "../../src/lib/captions/templates";
import type { CaptionStyleOverrides } from "../../src/lib/captions/style";
import {
  DEFAULT_BROLL_ENTRANCE_SFX,
  isVfxType,
  type AudioAsset,
} from "../../src/lib/episode/config-types";
import { isVideoSrc } from "../../src/lib/episode/media";
import { findIntroTextVfx } from "../../src/lib/episode/text-vfx";
import { defaultTextEntranceSfx } from "../../src/lib/episode/vfx";
import {
  DEFAULT_LISTICLE_TEMPLATE_ID,
  isListicleTemplateId,
} from "../../src/lib/listicle/templates";
import {
  DEFAULT_TEXT_TEMPLATE_ID,
  isTextTemplateId,
} from "../../src/lib/text/templates";
import { DEFAULT_PUNCH_IN_SCALE } from "../../src/lib/visual/punchin";
import { DEFAULT_TEXT_VFX_DURATION_SEC } from "./constants";
import {
  DEFAULT_CONFIG_PATH,
  EpisodeConfig,
  SOURCE_DIR,
  SourceBRoll,
  SourceCut,
  SourceCutout,
  SourceListicle,
  SourceListicleTextVfx,
  SourceMusic,
  SourcePunchIn,
  SourceSfx,
  SourceTextVfx,
  SourceVfx,
} from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Baked entrance SFX on b-roll / text VFX. `null` = silent; omit = unset. */
function parseEntranceSfx(
  value: unknown,
  pathLabel: string,
  configPath: string,
): AudioAsset | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string") {
    const src = value.trim();
    if (!src) return null;
    // Legacy shorthand (src only) — duration rewritten when re-saved from editor.
    return { src, srcDurationSec: 1 };
  }
  if (!isPlainObject(value)) {
    throw new Error(`"${pathLabel}" must be an object, string, or null in ${configPath}`);
  }
  const src = String(value.src ?? "").trim();
  const srcDurationSec = Number(value.srcDurationSec);
  if (!src || !Number.isFinite(srcDurationSec) || srcDurationSec <= 0) {
    throw new Error(
      `"${pathLabel}" needs src and positive srcDurationSec in ${configPath}`,
    );
  }
  const sfx: AudioAsset = { src, srcDurationSec };
  const volume = Number(value.volume);
  if (value.volume != null && Number.isFinite(volume)) {
    sfx.volume = Math.min(1, Math.max(0, volume));
  }
  return sfx;
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

function parseScreenTextFields(
  entry: Record<string, unknown>,
  path: string,
  configPath: string,
): {
  text: string;
  templateId: string;
  style: CaptionStyleOverrides;
  sfx: ReturnType<typeof parseEntranceSfx> extends infer T ? T : never;
} {
  const text = String(entry.text ?? "").trim();
  if (!text) {
    throw new Error(`"${path}" needs text in ${configPath}`);
  }
  const rawTemplate = String(entry.templateId ?? "").trim();
  const templateId = isTextTemplateId(rawTemplate)
    ? rawTemplate
    : DEFAULT_TEXT_TEMPLATE_ID;
  const style = normalizeCaptionOverrides(entry.style);
  const sfx = parseEntranceSfx(entry.sfx, `${path}.sfx`, configPath);
  return { text, templateId, style, sfx };
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
  const rawTemplate = String(value.templateId ?? "").trim();
  const templateId =
    rawTemplate && isListicleTemplateId(rawTemplate)
      ? rawTemplate
      : DEFAULT_LISTICLE_TEMPLATE_ID;
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
    const id = String(item.id ?? "").trim();
    const markerId = String(item.markerId ?? "").trim();
    const revealId = String(item.revealId ?? "").trim();
    if (!id || !markerId || !revealId) {
      throw new Error(
        `"listicleOverlay.items[${i}]" needs id, markerId, revealId in ${configPath}`,
      );
    }
    return { id, markerId, revealId };
  });
  return { start, end, templateId, items };
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
      ...(typeof entry.animate === "boolean" ? { animate: entry.animate } : {}),
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
    if (entry.offsetX != null && Number.isFinite(offsetX))
      clip.offsetX = offsetX;
    if (entry.offsetY != null && Number.isFinite(offsetY))
      clip.offsetY = offsetY;
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
    if (entry.behind === true) {
      clip.behind = true;
    }
    const sfx = parseEntranceSfx(entry.sfx, `bRolls[${index}].sfx`, configPath);
    if (sfx !== undefined) clip.sfx = sfx;
    return clip;
  });
}

function parseCutout(value: unknown, configPath: string): SourceCutout | null {
  if (value == null) return null;
  if (!isPlainObject(value)) {
    throw new Error(`"cutout" must be an object or null in ${configPath}`);
  }
  const src = String(value.src ?? "").trim();
  const width = Number(value.width);
  const height = Number(value.height);
  const srcDurationSec = Number(value.srcDurationSec);
  if (
    !src ||
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0 ||
    !Number.isFinite(srcDurationSec) ||
    srcDurationSec <= 0
  ) {
    throw new Error(
      `"cutout" needs src, positive width/height/srcDurationSec in ${configPath}`,
    );
  }
  const sourceRaw = value.source;
  if (!isPlainObject(sourceRaw)) {
    throw new Error(`"cutout.source" must be an object in ${configPath}`);
  }
  const size = Number(sourceRaw.size);
  const mtimeMs = Number(sourceRaw.mtimeMs);
  if (!Number.isFinite(size) || size < 0 || !Number.isFinite(mtimeMs)) {
    throw new Error(`"cutout.source" needs size and mtimeMs in ${configPath}`);
  }
  return {
    src,
    width,
    height,
    srcDurationSec,
    source: { size, mtimeMs },
  };
}

function parseDefaultBRollSfx(
  value: unknown,
  configPath: string,
): string | null {
  if (value === null) return null;
  if (value === undefined) return DEFAULT_BROLL_ENTRANCE_SFX;
  if (typeof value !== "string") {
    throw new Error(
      `"defaultBRollSfx" must be a string or null in ${configPath}`,
    );
  }
  const src = value.trim();
  return src.length > 0 ? src : null;
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
      throw new Error(`"vfx[${index}]" needs id, start, end in ${configPath}`);
    }
    if (!isVfxType(entry.type)) {
      throw new Error(
        `"vfx[${index}]" needs type (location | shake | quote | text | listicle-text) in ${configPath}`,
      );
    }

    if (entry.type === "shake") {
      const clip: SourceVfx = { id, type: "shake", start, end };
      const intensity = Number(entry.intensity);
      if (
        entry.intensity != null &&
        Number.isFinite(intensity) &&
        intensity > 0
      ) {
        clip.intensity = intensity;
      }
      return clip;
    }

    if (entry.type === "quote") {
      const rawTemplate = String(entry.templateId ?? "").trim();
      const templateId = isQuoteTemplateId(rawTemplate)
        ? rawTemplate
        : DEFAULT_QUOTE_TEMPLATE_ID;
      const style = normalizeCaptionOverrides(entry.style);
      return { id, type: "quote", start, end, templateId, style };
    }

    if (entry.type === "text") {
      const fields = parseScreenTextFields(
        entry,
        `vfx[${index}]`,
        configPath,
      );
      const clip: SourceTextVfx = {
        id,
        type: "text",
        start,
        end,
        text: fields.text,
        templateId: fields.templateId,
        style: fields.style,
      };
      if (fields.sfx !== undefined) clip.sfx = fields.sfx;
      return clip;
    }

    if (entry.type === "listicle-text") {
      const listicleItemId = String(entry.listicleItemId ?? "").trim();
      const role = entry.role;
      if (
        !listicleItemId ||
        (role !== "marker" && role !== "reveal")
      ) {
        throw new Error(
          `"vfx[${index}]" listicle-text needs listicleItemId and role (marker | reveal) in ${configPath}`,
        );
      }
      const fields = parseScreenTextFields(
        entry,
        `vfx[${index}]`,
        configPath,
      );
      const clip: SourceListicleTextVfx = {
        id,
        type: "listicle-text",
        start,
        end,
        listicleItemId,
        role,
        text: fields.text,
        templateId: fields.templateId,
        style: fields.style,
      };
      if (fields.sfx !== undefined) clip.sfx = fields.sfx;
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
    if (entry.offsetX != null && Number.isFinite(offsetX))
      clip.offsetX = offsetX;
    if (entry.offsetY != null && Number.isFinite(offsetY))
      clip.offsetY = offsetY;
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

function parseMusic(value: unknown, configPath: string): SourceMusic | null {
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

function ensureDefaultTextVfx(
  vfx: SourceVfx[],
  opts: { title: string | null },
): SourceVfx[] {
  if (vfx.some((clip) => clip.type === "text")) return vfx;

  const templateId = DEFAULT_TEXT_TEMPLATE_ID;
  const clip: SourceTextVfx = {
    id: "text-default",
    type: "text",
    start: 0,
    end: DEFAULT_TEXT_VFX_DURATION_SEC,
    text: opts.title ?? "",
    templateId,
    style: {},
    sfx: defaultTextEntranceSfx(DEFAULT_TEXT_VFX_DURATION_SEC),
  };
  return [...vfx, clip].sort((a, b) => a.start - b.start);
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

  const rawCaptionTemplate = String(merged.captionTemplateId ?? "").trim();
  const captionTemplateId = isCaptionTemplateId(rawCaptionTemplate)
    ? rawCaptionTemplate
    : DEFAULT_CAPTION_TEMPLATE_ID;
  const captionStyle = normalizeCaptionOverrides(merged.captionStyle);
  const vfx = ensureDefaultTextVfx(parseVfx(local.vfx, configPath), { title });

  return {
    aroll,
    title,
    captionTemplateId,
    captionStyle,
    listicle: Boolean(merged.listicle ?? false),
    punchIns: Boolean(merged.punchIns ?? false),
    emphasis: Boolean(merged.emphasis ?? false),
    cuts: parseCuts(local.cuts, configPath),
    listicleOverlay: parseListicleOverlay(local.listicleOverlay, configPath),
    punchInSegments: parsePunchInSegments(local.punchInSegments, configPath),
    bRolls: parseBRolls(local.bRolls, configPath),
    vfx,
    sfx: parseSfx(local.sfx, configPath),
    music: parseMusic(local.music, configPath),
    defaultBRollSfx: parseDefaultBRollSfx(merged.defaultBRollSfx, configPath),
    cutout: parseCutout(local.cutout, configPath),
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

/** Write episode title and ensure a default intro text VFX exists. */
export function writeEpisodeTitle(
  episodeDir: string,
  title: string,
): SourceVfx[] {
  const configPath = path.join(episodeDir, "config.yaml");
  const existing = readYaml(configPath);
  let vfx = ensureDefaultTextVfx(parseVfx(existing.vfx, configPath), { title });
  const intro = findIntroTextVfx(vfx, Number.POSITIVE_INFINITY);
  if (intro && intro.text.trim() === "") {
    vfx = vfx.map((clip) =>
      clip.id === intro.id ? { ...clip, text: title } : clip,
    );
  }
  writeEpisodeConfig(episodeDir, { title, vfx });
  return vfx;
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
