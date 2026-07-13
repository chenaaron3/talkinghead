import type { SourceBRoll } from "@src/lib/types";

export function bRollsOverlap(
  clips: SourceBRoll[],
  candidate: { start: number; end: number; id?: string },
): boolean {
  return clips.some((clip) => {
    if (candidate.id && clip.id === candidate.id) return false;
    return candidate.start < clip.end && candidate.end > clip.start;
  });
}

export function upsertBRoll(
  bRolls: SourceBRoll[],
  clip: SourceBRoll,
): SourceBRoll[] | { error: string } {
  const others = bRolls.filter((c) => c.id !== clip.id);
  if (clip.end <= clip.start) {
    return { error: "B-roll end must be after start" };
  }
  if (bRollsOverlap(others, clip)) {
    return { error: "B-roll overlaps another clip" };
  }
  return [...others, clip].sort((a, b) => a.start - b.start);
}

export function removeBRoll(
  bRolls: SourceBRoll[],
  id: string,
): SourceBRoll[] {
  return bRolls.filter((c) => c.id !== id);
}

/** Snap a source timestamp to the nearest caption boundary. */
export function snapToCaptionBoundary(
  sec: number,
  captions: { start: number; end: number }[],
  edge: "start" | "end",
): number {
  if (captions.length === 0) return sec;
  let best = sec;
  let bestDist = Infinity;
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
