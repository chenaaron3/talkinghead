import type { EpisodeConfig } from "@src/lib/types";
import {
  adjustKeepEdge,
  cutsToGaps,
  removeCut,
} from "@src/lib/source-timeline";

export type SourceGap = {
  id: number;
  start: number;
  end: number;
};

export function sourceGaps(config: EpisodeConfig): SourceGap[] {
  return cutsToGaps(config.cuts);
}

/** Expand/shrink a keep region edge by adjusting adjacent cuts. */
export function adjustSectionEdge(
  config: EpisodeConfig,
  keepRegionIndex: number,
  edge: "start" | "end",
  deltaSec: number,
  durationSec: number,
): EpisodeConfig {
  return {
    ...config,
    cuts: adjustKeepEdge(
      config.cuts,
      keepRegionIndex,
      edge,
      deltaSec,
      durationSec,
    ),
  };
}

/** Restore a cut (remove it from config). */
export function restoreGap(
  config: EpisodeConfig,
  gapId: number,
): EpisodeConfig {
  return {
    ...config,
    cuts: removeCut(config.cuts, gapId),
  };
}
