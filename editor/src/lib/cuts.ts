import { normalizeCuts } from "@src/lib/source-timeline";
import type { SourceCut } from "@src/lib/types";

export function cutForCaption(
  cuts: SourceCut[],
  caption: { start: number; end: number },
): SourceCut[] {
  if (caption.end <= caption.start) return cuts;
  return normalizeCuts([...cuts, { start: caption.start, end: caption.end }]);
}

export function captionInCut(
  caption: { start: number; end: number },
  cuts: SourceCut[],
): boolean {
  return normalizeCuts(cuts).some(
    (cut) => caption.start < cut.end && caption.end > cut.start,
  );
}
