/** Snap a source timestamp to the start of the nearest caption. */
export function snapToNearestCaptionStart(
  sec: number,
  captions: { start: number }[],
): number {
  if (captions.length === 0) return sec;
  let best = captions[0]!.start;
  let bestDist = Math.abs(best - sec);
  for (const cap of captions) {
    const dist = Math.abs(cap.start - sec);
    if (dist < bestDist) {
      bestDist = dist;
      best = cap.start;
    }
  }
  return best;
}

/** Timeline drags snap by default; hold Shift for fine adjustment. */
export function maybeSnapTimelineSec(
  sec: number,
  captions: { start: number }[],
  shiftKey: boolean,
): number {
  return shiftKey ? sec : snapToNearestCaptionStart(sec, captions);
}
