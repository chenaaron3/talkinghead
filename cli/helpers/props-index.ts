import fs from "node:fs";
import path from "node:path";
import { listProcessedEpisodes } from "./config";
import type { EpisodeProps } from "../../src/lib/types";
import {
  GENERATED_EPISODES_INDEX,
  ROOT,
  SOURCE_DIR,
} from "./types";

export const ALL_PROPS_PATH = path.join(ROOT, "src", "generated", "all-props.json");

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/**
 * Rebuild Studio's all-props.json purely from each episode's generated/props.json.
 * Per-episode props.json is the source of truth; all-props.json is only a
 * Remotion Studio cache (the browser bundle cannot read the filesystem).
 */
export function rebuildAllPropsIndex(latest?: EpisodeProps): string[] {
  const episodes = listProcessedEpisodes();
  writeJson(GENERATED_EPISODES_INDEX, { episodes });

  const allProps: Record<string, EpisodeProps> = {};
  for (const id of episodes) {
    const propsPath = path.join(SOURCE_DIR, id, "generated", "props.json");
    if (!fs.existsSync(propsPath)) continue;
    allProps[id] = JSON.parse(
      fs.readFileSync(propsPath, "utf8"),
    ) as EpisodeProps;
  }
  if (latest) {
    allProps[latest.episodeId] = latest;
  }

  writeJson(ALL_PROPS_PATH, allProps);
  return episodes;
}
