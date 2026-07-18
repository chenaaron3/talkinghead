/** Snap a source timestamp to the nearest caption start or end. */
export function snapToNearestCaptionBoundary(
  sec: number,
  captions: { start: number; end: number }[],
  edge: "start" | "end",
): number {
  if (captions.length === 0) return sec;
  let best = edge === "start" ? captions[0]!.start : captions[0]!.end;
  let bestDist = Math.abs(best - sec);
  for (const cap of captions) {
    const point = edge === "start" ? cap.start : cap.end;
    const dist = Math.abs(point - sec);
    if (dist < bestDist) {
      bestDist = dist;
      best = point;
    }
  }
  return best;
}

/** Timeline drags snap by default; hold Shift for fine adjustment. */
export function maybeSnapTimelineSec(
  sec: number,
  captions: { start: number; end: number }[],
  shiftKey: boolean,
  edge: "start" | "end" = "start",
): number {
  return shiftKey ? sec : snapToNearestCaptionBoundary(sec, captions, edge);
}
