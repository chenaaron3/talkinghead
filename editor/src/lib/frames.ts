import {
    cutsToKeepSegments, mapSourceSecToOutputFrame, snapSourceSecToKeep
} from '@src/lib/source-timeline';

import type { EpisodeConfig } from "@src/lib/types";

/** Convert source seconds to output frame for preview (snaps to keep regions). */
export function sourceSecToOutputFrame(
  sourceSec: number,
  config: EpisodeConfig,
  fps: number,
  durationSec: number,
): number {
  const snapped = snapSourceSecToKeep(sourceSec, config.cuts, durationSec);
  const segments = cutsToKeepSegments(config.cuts, fps, durationSec);
  return mapSourceSecToOutputFrame(snapped, segments, fps) ?? 0;
}
