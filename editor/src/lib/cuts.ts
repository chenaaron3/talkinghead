import {
  captionFullyInCuts,
  mergeCutsOverRemovedCaptions,
  normalizeCuts,
} from "@src/lib/source-timeline";
import type { SourceCut, TranscriptCaption } from "@src/lib/types";

export function cutForPause(
  cuts: SourceCut[],
  range: { start: number; end: number },
): SourceCut[] {
  if (range.end <= range.start) return cuts;
  return normalizeCuts([...cuts, { start: range.start, end: range.end }]);
}

export function cutForCaption(
  cuts: SourceCut[],
  range: { start: number; end: number },
  captions: readonly TranscriptCaption[],
): SourceCut[] {
  if (range.end <= range.start) return cuts;
  const next = normalizeCuts([
    ...cuts,
    { start: range.start, end: range.end },
  ]);
  return mergeCutsOverRemovedCaptions(next, captions);
}

/** True when no portion of the caption remains in the kept video. */
export function captionInCut(
  caption: { start: number; end: number },
  cuts: SourceCut[],
): boolean {
  return captionFullyInCuts(caption, cuts);
}
