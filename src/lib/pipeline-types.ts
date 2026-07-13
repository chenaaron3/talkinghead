import type { EpisodeConfig } from "./config-types";
import type { Transcript } from "./transcript-types";

/** Intermediate keep segment used when mapping source cuts → output frames. */
export type KeepSegment = {
  startSec: number;
  endSec: number;
  outputStartSec: number;
  outputEndSec: number;
  trimBefore: number;
  trimAfter: number;
  durationInFrames: number;
};

export type BuildPropsInput = {
  episodeId: string;
  title: string;
  videoSrc: string;
  fps: number;
  width?: number;
  height?: number;
  config: EpisodeConfig;
  transcript: Transcript;
};
