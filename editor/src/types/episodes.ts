export type EpisodeListItem = {
  episodeId: string;
  title: string;
  scheduledAt: string | null;
  scheduledLabel: string | null;
  fullyScheduled: boolean;
};
