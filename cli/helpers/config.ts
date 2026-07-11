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
  SOURCE_DIR,
  VIDEO_EXTENSIONS,
} from "./types";

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

export function findSourceVideo(episodeDir: string): string {
  const entries = fs
    .readdirSync(episodeDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => VIDEO_EXTENSIONS.has(path.extname(name)));

  if (entries.length === 0) {
    throw new Error(
      `No video found in ${episodeDir}. Add exactly one .mp4 / .mov / .webm file.`,
    );
  }
  if (entries.length > 1) {
    throw new Error(
      `Multiple videos in ${episodeDir}: ${entries.join(", ")}. Keep exactly one.`,
    );
  }
  return path.join(episodeDir, entries[0]!);
}

export function loadEpisodeConfig(episodeDir: string): EpisodeConfig {
  const defaults = readYaml(DEFAULT_CONFIG_PATH);
  const local = readYaml(path.join(episodeDir, "config.yaml"));
  const merged = deepMerge(defaults, local);

  const title = String(merged.title ?? "").trim();
  if (!title) {
    throw new Error(
      `Missing required "title" in ${path.join(episodeDir, "config.yaml")}`,
    );
  }

  return {
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
  };
}

export function listProcessedEpisodes(): string[] {
  if (!fs.existsSync(SOURCE_DIR)) return [];
  return fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) =>
      fs.existsSync(path.join(SOURCE_DIR, name, "generated", "props.json")),
    )
    .sort();
}
