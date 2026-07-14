import { normalizeCuts } from "@src/lib/source-timeline";
import type { SourceCut } from "@src/lib/types";

export function cutForCaption(
  cuts: SourceCut[],
  caption: { start: number; end: number },
): SourceCut[] {
  if (caption.end <= caption.start) return cuts;
  return normalizeCuts([...cuts, { start: caption.start, end: caption.end }]);
}
