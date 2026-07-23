import {
    cutsToKeepSegments, mapSourceSecToOutputFrame, snapSourceSecToKeep
} from '@src/lib/timeline/source-timeline';

import type { EpisodeConfig } from "@src/lib/types";
import type { EpisodeProps } from "@src/lib/episode/props-types";

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

/** Map output composition frame back to source seconds (for playhead during playback). */
export function outputFrameToSourceSec(
  frame: number,
  props: EpisodeProps,
): number {
  const fps = props.fps;
  const outputSec = frame / fps;
  let cursor = 0;
  for (const s of props.sections) {
    const segEnd = cursor + s.durationInFrames / fps;
    if (outputSec >= cursor && outputSec <= segEnd + 0.001) {
      return s.trimBefore / fps + (outputSec - cursor);
    }
    cursor = segEnd;
  }
  return 0;
}
