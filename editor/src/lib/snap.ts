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
