import type { PlatformId, PlatformPublisher } from "../types";
import { createInstagramPublisher } from "./instagram";
import { createTikTokPublisher } from "./tiktok";
import { youtubePublisher } from "./youtube";

export function getPublishers(
  platforms: PlatformId[],
  timeZone: string,
): PlatformPublisher[] {
  const all: Record<PlatformId, PlatformPublisher> = {
    youtube: youtubePublisher,
    instagram: createInstagramPublisher(timeZone),
    tiktok: createTikTokPublisher(timeZone),
  };
  return platforms.map((id) => all[id]);
}
