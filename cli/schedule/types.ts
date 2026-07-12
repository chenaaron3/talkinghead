import type { BrowserContext } from "playwright";

export type PlatformId = "youtube" | "instagram" | "tiktok";

export type ScheduleConfig = {
  time: string; // HH:MM
  timezone: string;
  platforms: PlatformId[];
};

export type ScheduleInput = {
  title: string;
  videoPath: string;
  coverPath: string;
  publishAt: Date;
};

export type ScheduleResult = {
  url: string | null;
};

export type PlatformPublisher = {
  id: PlatformId;
  /** Browser platforms accept a shared Playwright context for parallel runs. */
  schedule(
    input: ScheduleInput,
    context?: BrowserContext,
  ): Promise<ScheduleResult>;
};

export type ManifestEntry = {
  episodeId: string;
  createdAt: string;
  scheduledAt: string;
  videoSrc: string;
  coverSrc: string;
  title: string;
  youtube: string | null;
  instagram: string | null;
  tiktok: string | null;
};

export type ScheduleManifest = {
  entries: ManifestEntry[];
};
