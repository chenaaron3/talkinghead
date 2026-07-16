import fs from "node:fs";
import path from "node:path";
import { loadEpisodeConfig } from "../../cli/helpers/config";
import { SOURCE_DIR } from "../../cli/helpers/types";
import { formatLocalSlot } from "../../cli/schedule/cadence";
import { loadScheduleConfig } from "../../cli/schedule/config";
import {
  findEntry,
  isFullyScheduled,
  loadManifest,
} from "../../cli/schedule/manifest";
import type { EpisodeListItem } from "../src/types/episodes";

function listEditorEpisodeIds(): string[] {
  if (!fs.existsSync(SOURCE_DIR)) return [];
  return fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "_bulk")
    .filter((name) =>
      fs.existsSync(
        path.join(SOURCE_DIR, name, "generated", "transcript.json"),
      ),
    )
    .sort((a, b) => {
      const aPath = path.join(SOURCE_DIR, a);
      const bPath = path.join(SOURCE_DIR, b);
      return fs.statSync(bPath).mtimeMs - fs.statSync(aPath).mtimeMs;
    });
}

function getScheduleContext() {
  const manifest = loadManifest();
  let timezone = "America/New_York";
  let platforms: Array<"youtube" | "instagram" | "tiktok"> = [
    "youtube",
    "instagram",
    "tiktok",
  ];
  try {
    const scheduleConfig = loadScheduleConfig();
    timezone = scheduleConfig.timezone;
    platforms = scheduleConfig.platforms;
  } catch {
    // schedule.config.yaml may be missing during local dev
  }
  return { manifest, timezone, platforms };
}

export function getEpisodeScheduleInfo(episodeId: string): {
  scheduledAt: string | null;
  scheduledLabel: string | null;
  fullyScheduled: boolean;
} {
  const { manifest, timezone, platforms } = getScheduleContext();
  const entry = findEntry(manifest, episodeId);
  const scheduledAt = entry?.scheduledAt ?? null;
  const fullyScheduled = entry ? isFullyScheduled(entry, platforms) : false;
  return {
    scheduledAt,
    scheduledLabel: scheduledAt
      ? formatLocalSlot(new Date(scheduledAt), timezone)
      : null,
    fullyScheduled,
  };
}

export function listEditorEpisodes(): EpisodeListItem[] {
  return listEditorEpisodeIds().map((episodeId) => {
    const episodeDir = path.join(SOURCE_DIR, episodeId);
    const config = loadEpisodeConfig(episodeDir);
    const title = config.title ?? episodeId;
    const schedule = getEpisodeScheduleInfo(episodeId);

    return {
      episodeId,
      title,
      ...schedule,
    };
  });
}
