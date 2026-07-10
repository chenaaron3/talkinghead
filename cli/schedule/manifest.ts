import fs from "node:fs";
import { MANIFEST_PATH } from "./config";
import type { ManifestEntry, PlatformId, ScheduleManifest } from "./types";

function emptyManifest(): ScheduleManifest {
  return { entries: [] };
}

export function loadManifest(): ScheduleManifest {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return emptyManifest();
  }
  try {
    const data = JSON.parse(
      fs.readFileSync(MANIFEST_PATH, "utf8"),
    ) as ScheduleManifest;
    if (!data || !Array.isArray(data.entries)) {
      return emptyManifest();
    }
    return data;
  } catch {
    return emptyManifest();
  }
}

export function saveManifest(manifest: ScheduleManifest): void {
  fs.writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

export function findEntry(
  manifest: ScheduleManifest,
  episodeId: string,
): ManifestEntry | undefined {
  return manifest.entries.find((e) => e.episodeId === episodeId);
}

export function isPlatformDone(
  entry: ManifestEntry,
  platform: PlatformId,
): boolean {
  return Boolean(entry[platform]);
}

export function isFullyScheduled(
  entry: ManifestEntry,
  platforms: PlatformId[],
): boolean {
  return platforms.every((p) => isPlatformDone(entry, p));
}

export function missingPlatforms(
  entry: ManifestEntry | undefined,
  platforms: PlatformId[],
): PlatformId[] {
  if (!entry) return [...platforms];
  return platforms.filter((p) => !isPlatformDone(entry, p));
}

/** All scheduledAt values used for cadence (any entry that has at least one platform link or a scheduledAt). */
export function scheduledAtsForCadence(manifest: ScheduleManifest): string[] {
  return manifest.entries
    .filter(
      (e) =>
        e.scheduledAt &&
        (e.youtube || e.instagram || e.tiktok || e.scheduledAt),
    )
    .map((e) => e.scheduledAt);
}

export function upsertEntry(
  manifest: ScheduleManifest,
  entry: ManifestEntry,
): ScheduleManifest {
  const idx = manifest.entries.findIndex((e) => e.episodeId === entry.episodeId);
  const entries = [...manifest.entries];
  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }
  return { entries };
}
