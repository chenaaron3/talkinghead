export const MIN_RANGE_SEC = 0.04;
export const MIN_LISTICLE_SEC = 0.1;

/** Move one edge; keep the opposite edge fixed and enforce minimum duration. */
export function clampRangeEdge(
  edge: "start" | "end",
  value: number,
  range: { start: number; end: number },
  minLen = MIN_RANGE_SEC,
): { start: number; end: number } {
  if (edge === "start") {
    const start = Math.min(value, range.end - minLen);
    return { start: Math.max(0, start), end: range.end };
  }
  const end = Math.max(value, range.start + minLen);
  return { start: range.start, end };
}
