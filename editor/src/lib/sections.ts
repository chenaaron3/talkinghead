import type { EpisodeConfig } from "@src/lib/types";
import {
  cutsToGaps,
  cutsToKeepRegions,
  normalizeCuts,
  removeCut,
  setKeepEdge,
} from "@src/lib/timeline/source-timeline";

export type SourceGap = {
  id: number;
  start: number;
  end: number;
};

export function sourceGaps(config: EpisodeConfig): SourceGap[] {
  return cutsToGaps(config.cuts);
}

/** Move a keep region edge to an absolute source timestamp. */
export function setSectionEdge(
  config: EpisodeConfig,
  keepRegionIndex: number,
  edge: "start" | "end",
  targetSec: number,
  durationSec: number,
): EpisodeConfig {
  return {
    ...config,
    cuts: setKeepEdge(
      config.cuts,
      keepRegionIndex,
      edge,
      targetSec,
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

/** Remove a keep region by adding a cut; adjacent cuts are merged. */
export function cutKeepRegion(
  config: EpisodeConfig,
  keepRegionIndex: number,
  durationSec: number,
): EpisodeConfig {
  const keep = cutsToKeepRegions(config.cuts, durationSec)[keepRegionIndex];
  if (!keep || keep.end - keep.start < 0.001) return config;

  return {
    ...config,
    cuts: normalizeCuts([
      ...config.cuts,
      { start: keep.start, end: keep.end },
    ]),
  };
}
