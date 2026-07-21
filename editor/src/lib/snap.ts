/** Prefer keep edge over first/last word when they are this close (transcript hover). */
export const TRANSCRIPT_KEEP_EDGE_SNAP_SEC = 1;

type Timed = { start: number; end: number; index?: number };

function overlaps(a: Timed, b: { start: number; end: number }): boolean {
  return a.start < b.end - 0.001 && a.end > b.start + 0.001;
}

/**
 * Transcript word-hover: if this is the first/last word in its keep region and
 * the word edge is within threshold of the keep edge, snap to the keep edge.
 * Reduces jitter from tiny silence tails at section boundaries.
 */
export function snapTranscriptCaptionEdge(
  caption: Timed,
  edge: "start" | "end",
  captions: Timed[],
  keeps: { start: number; end: number }[],
  thresholdSec = TRANSCRIPT_KEEP_EDGE_SNAP_SEC,
): number {
  const wordSec = edge === "start" ? caption.start : caption.end;
  const keep = keeps.find((k) => overlaps(caption, k));
  if (!keep) return wordSec;

  const inKeep = captions.filter((c) => overlaps(c, keep));
  if (inKeep.length === 0) return wordSec;

  if (edge === "start") {
    const first = inKeep.reduce((a, b) =>
      (a.index ?? a.start) <= (b.index ?? b.start) ? a : b,
    );
    const isFirst =
      caption.index != null && first.index != null
        ? caption.index === first.index
        : caption.start === first.start && caption.end === first.end;
    if (isFirst && Math.abs(caption.start - keep.start) < thresholdSec) {
      return keep.start;
    }
  } else {
    const last = inKeep.reduce((a, b) =>
      (a.index ?? a.end) >= (b.index ?? b.end) ? a : b,
    );
    const isLast =
      caption.index != null && last.index != null
        ? caption.index === last.index
        : caption.start === last.start && caption.end === last.end;
    if (isLast && Math.abs(keep.end - caption.end) < thresholdSec) {
      return keep.end;
    }
  }

  return wordSec;
}

/** Snap a source timestamp to the nearest range start or end. */
export function snapToNearestBoundary(
  sec: number,
  ranges: { start: number; end: number }[],
  edge: "start" | "end",
): number {
  if (ranges.length === 0) return sec;
  let best = edge === "start" ? ranges[0]!.start : ranges[0]!.end;
  let bestDist = Math.abs(best - sec);
  for (const range of ranges) {
    const point = edge === "start" ? range.start : range.end;
    const dist = Math.abs(point - sec);
    if (dist < bestDist) {
      bestDist = dist;
      best = point;
    }
  }
  return best;
}

/**
 * Timeline drags snap by default; hold Shift for fine adjustment.
 * Start handles prefer starts (captions + keep regions); end handles prefer ends.
 */
export function maybeSnapTimelineSec(
  sec: number,
  captions: { start: number; end: number }[],
  shiftKey: boolean,
  edge: "start" | "end" = "start",
  keeps: { start: number; end: number }[] = [],
): number {
  if (shiftKey) return sec;
  if (keeps.length === 0) {
    return snapToNearestBoundary(sec, captions, edge);
  }
  return snapToNearestBoundary(sec, [...captions, ...keeps], edge);
}
