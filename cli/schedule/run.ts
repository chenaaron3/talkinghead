import fs from "node:fs";
import path from "node:path";
import { loadEpisodeConfig, resolveEpisodeDir } from "../config";
import { ROOT } from "../types";
import { formatLocalSlot, nextPublishAt } from "./cadence";
import { loadScheduleConfig } from "./config";
import {
  findEntry,
  isFullyScheduled,
  loadManifest,
  missingPlatforms,
  saveManifest,
  scheduledAtsForCadence,
  upsertEntry,
} from "./manifest";
import { getPublishers } from "./platforms";
import type { ManifestEntry, PlatformId } from "./types";

function parseArgs(argv: string[]) {
  const platformsFlagIdx = argv.indexOf("--platforms");
  let platformsOverride: PlatformId[] | undefined;
  const rest = [...argv];

  if (platformsFlagIdx >= 0) {
    const values: string[] = [];
    let i = platformsFlagIdx + 1;
    while (i < rest.length && !rest[i]!.startsWith("--")) {
      values.push(rest[i]!);
      i++;
    }
    platformsOverride = values.map((v) => v.toLowerCase() as PlatformId);
    rest.splice(platformsFlagIdx, i - platformsFlagIdx);
  }

  const positional = rest.filter((a) => !a.startsWith("--"));
  if (positional.length === 0) {
    throw new Error(
      "Usage: pnpm schedule -- source/<episode> [--platforms youtube instagram tiktok]\n" +
        "Example: pnpm schedule -- source/day1",
    );
  }

  return { input: positional[0]!, platformsOverride };
}

function requireRenderedAssets(episodeId: string): {
  videoPath: string;
  coverPath: string;
} {
  const outDir = path.join(ROOT, "out", episodeId);
  const videoPath = path.join(outDir, "video.mp4");
  const coverPath = path.join(outDir, "cover.jpg");
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Missing rendered video: ${videoPath}\nRun: pnpm process -- source/${episodeId}`);
  }
  if (!fs.existsSync(coverPath)) {
    throw new Error(`Missing cover image: ${coverPath}\nRun: pnpm process -- source/${episodeId}`);
  }
  return { videoPath, coverPath };
}

export async function runSchedule(argv: string[]): Promise<void> {
  const { input, platformsOverride } = parseArgs(argv);
  const { episodeId, episodeDir } = resolveEpisodeDir(input);
  const episodeConfig = loadEpisodeConfig(episodeDir);
  const scheduleConfig = loadScheduleConfig();
  const platforms = platformsOverride ?? scheduleConfig.platforms;
  const { videoPath, coverPath } = requireRenderedAssets(episodeId);

  let manifest = loadManifest();
  const existing = findEntry(manifest, episodeId);

  if (existing && isFullyScheduled(existing, platforms)) {
    throw new Error(
      `Episode "${episodeId}" is already fully scheduled on: ${platforms.join(", ")}\n` +
        `Manifest: schedule-manifest.json`,
    );
  }

  const toRun = missingPlatforms(existing, platforms);
  if (toRun.length === 0) {
    console.log(`[schedule] nothing to do for ${episodeId}`);
    return;
  }

  // Cadence: reuse existing entry's scheduledAt on partial retry; else compute next slot
  let publishAt: Date;
  if (existing?.scheduledAt) {
    publishAt = new Date(existing.scheduledAt);
    console.log(
      `[schedule] retrying ${episodeId} at existing slot ${formatLocalSlot(publishAt, scheduleConfig.timezone)}`,
    );
  } else {
    // Exclude this episode from cadence basis if somehow present without scheduledAt
    const others = scheduledAtsForCadence({
      entries: manifest.entries.filter((e) => e.episodeId !== episodeId),
    });
    publishAt = nextPublishAt({
      scheduledAts: others,
      time: scheduleConfig.time,
      timezone: scheduleConfig.timezone,
    });
    console.log(
      `[schedule] next slot: ${formatLocalSlot(publishAt, scheduleConfig.timezone)} (${scheduleConfig.timezone})`,
    );
  }

  const entry: ManifestEntry = existing ?? {
    episodeId,
    createdAt: new Date().toISOString(),
    scheduledAt: publishAt.toISOString(),
    videoSrc: path.relative(ROOT, videoPath),
    coverSrc: path.relative(ROOT, coverPath),
    title: episodeConfig.title,
    youtube: null,
    instagram: null,
    tiktok: null,
  };

  // Ensure scheduledAt is set for new entries
  entry.scheduledAt = publishAt.toISOString();
  entry.title = episodeConfig.title;
  entry.videoSrc = path.relative(ROOT, videoPath);
  entry.coverSrc = path.relative(ROOT, coverPath);

  console.log(`[schedule] episode=${episodeId}`);
  console.log(`[schedule] title="${episodeConfig.title}"`);
  console.log(`[schedule] platforms: ${toRun.join(", ")}`);

  const publishers = getPublishers(toRun, scheduleConfig.timezone);
  const failures: string[] = [];

  for (const publisher of publishers) {
    try {
      console.log(`\n[schedule] → ${publisher.id}`);
      const result = await publisher.schedule({
        title: episodeConfig.title,
        videoPath,
        coverPath,
        publishAt,
      });
      if (!result.url) {
        throw new Error(`${publisher.id} returned no post link`);
      }
      entry[publisher.id] = result.url;
      manifest = upsertEntry(manifest, entry);
      saveManifest(manifest);
      console.log(`[schedule] ${publisher.id} ok → ${result.url}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[schedule] ${publisher.id} failed: ${message}`);
      failures.push(`${publisher.id}: ${message}`);
      // Persist partial progress
      manifest = upsertEntry(manifest, entry);
      saveManifest(manifest);
    }
  }

  console.log(`\n[schedule] manifest → schedule-manifest.json`);
  if (failures.length > 0) {
    throw new Error(
      `Partial failure. Re-run the same command to retry missing platforms.\n` +
        failures.map((f) => `  - ${f}`).join("\n"),
    );
  }
  console.log(`[schedule] done — ${episodeId} scheduled on ${toRun.join(", ")}`);
}
