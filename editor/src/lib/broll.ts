import type { SourceBRoll, Transform } from "@src/lib/types";

export type { Transform };

export const TRANSFORM_DEFAULTS: Transform = {
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
};

export const BROLL_SCALE_MIN = 0.2;
export const BROLL_SCALE_MAX = 3;

export function resolveTransform(partial: Partial<Transform>): Transform {
  return {
    scale: partial.scale ?? TRANSFORM_DEFAULTS.scale,
    offsetX: partial.offsetX ?? TRANSFORM_DEFAULTS.offsetX,
    offsetY: partial.offsetY ?? TRANSFORM_DEFAULTS.offsetY,
    rotation: partial.rotation ?? TRANSFORM_DEFAULTS.rotation,
  };
}

export function clampBRollScale(scale: number): number {
  return Math.min(BROLL_SCALE_MAX, Math.max(BROLL_SCALE_MIN, scale));
}

/** Write only non-default transform fields (omit identity in config.yaml). */
export function withBRollTransform(
  clip: SourceBRoll,
  patch: Partial<Transform>,
): SourceBRoll {
  const next = resolveTransform(clip);
  if (patch.scale != null) next.scale = clampBRollScale(patch.scale);
  if (patch.offsetX != null) next.offsetX = patch.offsetX;
  if (patch.offsetY != null) next.offsetY = patch.offsetY;
  if (patch.rotation != null) next.rotation = patch.rotation;

  const out: SourceBRoll = {
    id: clip.id,
    src: clip.src,
    start: clip.start,
    end: clip.end,
  };
  if (next.scale !== TRANSFORM_DEFAULTS.scale) out.scale = next.scale;
  if (next.offsetX !== TRANSFORM_DEFAULTS.offsetX) {
    out.offsetX = next.offsetX;
  }
  if (next.offsetY !== TRANSFORM_DEFAULTS.offsetY) {
    out.offsetY = next.offsetY;
  }
  if (next.rotation !== TRANSFORM_DEFAULTS.rotation) {
    out.rotation = next.rotation;
  }
  return out;
}

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

export function removeBRoll(bRolls: SourceBRoll[], id: string): SourceBRoll[] {
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

/** True when playhead is inside the clip's source range. */
export function isBRollActiveAt(
  clip: Pick<SourceBRoll, "start" | "end">,
  sourceSec: number,
): boolean {
  return sourceSec >= clip.start && sourceSec < clip.end;
}
