import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { ROOT } from "../helpers/types";
import type { PlatformId, ScheduleConfig } from "./types";

export const SCHEDULE_CONFIG_PATH = path.join(ROOT, "schedule.config.yaml");
export const MANIFEST_PATH = path.join(ROOT, "schedule-manifest.json");
export const PLAYWRIGHT_PROFILE_DIR = path.join(ROOT, ".playwright", "profile");
export const YOUTUBE_CREDENTIALS_PATH = path.join(
  ROOT,
  "secrets",
  "youtube-credentials.json",
);
export const YOUTUBE_TOKEN_PATH = path.join(ROOT, "secrets", "youtube-token.json");

const VALID_PLATFORMS = new Set<PlatformId>([
  "youtube",
  "instagram",
  "tiktok",
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function loadScheduleConfig(): ScheduleConfig {
  if (!fs.existsSync(SCHEDULE_CONFIG_PATH)) {
    throw new Error(`Missing ${SCHEDULE_CONFIG_PATH}`);
  }
  const parsed = YAML.parse(fs.readFileSync(SCHEDULE_CONFIG_PATH, "utf8"));
  if (!isPlainObject(parsed)) {
    throw new Error(`Invalid schedule config: ${SCHEDULE_CONFIG_PATH}`);
  }

  const time = String(parsed.time ?? "17:00").trim();
  if (!/^\d{1,2}:\d{2}$/.test(time)) {
    throw new Error(`Invalid time "${time}" in schedule.config.yaml (use HH:MM)`);
  }

  const timezone = String(parsed.timezone ?? "America/New_York").trim();
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new Error(`Invalid timezone "${timezone}" in schedule.config.yaml`);
  }

  const rawPlatforms = Array.isArray(parsed.platforms)
    ? parsed.platforms
    : ["youtube", "instagram", "tiktok"];
  const platforms = rawPlatforms
    .map((p) => String(p).toLowerCase() as PlatformId)
    .filter((p) => VALID_PLATFORMS.has(p));

  if (platforms.length === 0) {
    throw new Error("schedule.config.yaml platforms list is empty");
  }

  return { time, timezone, platforms };
}

export function parseTimeOfDay(time: string): { hour: number; minute: number } {
  const [h, m] = time.split(":").map((x) => Number(x));
  if (
    h === undefined ||
    m === undefined ||
    !Number.isInteger(h) ||
    !Number.isInteger(m) ||
    h < 0 ||
    h > 23 ||
    m < 0 ||
    m > 59
  ) {
    throw new Error(`Invalid time of day: ${time}`);
  }
  return { hour: h, minute: m };
}
