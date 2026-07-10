import path from "node:path";

export * from "../src/lib/types";

export const ROOT = path.resolve(__dirname, "..");
export const SOURCE_DIR = path.join(ROOT, "source");
export const DEFAULT_CONFIG_PATH = path.join(ROOT, "config.default.yaml");
export const PUBLIC_EPISODES_DIR = path.join(ROOT, "public", "episodes");
export const GENERATED_EPISODES_INDEX = path.join(
  ROOT,
  "src",
  "generated",
  "episodes.json",
);

export const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".webm",
  ".MP4",
  ".MOV",
  ".WEBM",
]);
