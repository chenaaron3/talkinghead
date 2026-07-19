export const PUNCH_IN_STRENGTH = {
  light: 1.1,
  medium: 1.25,
  strong: 1.5,
} as const;

export type PunchInStrength = keyof typeof PUNCH_IN_STRENGTH;

export const DEFAULT_PUNCH_IN_SCALE = PUNCH_IN_STRENGTH.medium;
export const DEFAULT_PUNCH_IN_ANIMATE = false;
export const DEFAULT_PUNCH_IN_WORD_BY_WORD = false;
/** Faces sit above center in 9:16 talking-head framing. */
export const DEFAULT_PUNCH_IN_ORIGIN_X = 0.5;
export const DEFAULT_PUNCH_IN_ORIGIN_Y = 0.35;

export function clampPunchInOrigin(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function resolvePunchInOrigin(partial: {
  originX?: number;
  originY?: number;
}): { originX: number; originY: number } {
  return {
    originX: partial.originX ?? DEFAULT_PUNCH_IN_ORIGIN_X,
    originY: partial.originY ?? DEFAULT_PUNCH_IN_ORIGIN_Y,
  };
}

export function punchInStrengthFromScale(scale: number): PunchInStrength {
  let best: PunchInStrength = "medium";
  let bestDist = Infinity;
  for (const [name, value] of Object.entries(PUNCH_IN_STRENGTH) as Array<
    [PunchInStrength, number]
  >) {
    const dist = Math.abs(value - scale);
    if (dist < bestDist) {
      bestDist = dist;
      best = name;
    }
  }
  return best;
}

/** < 1 softens compounding; lower = gentler late zooms. */
const WORD_BY_WORD_TAPER = 0.4;

/**
 * Root-damped geometric: strength^((index+1)^taper).
 * First word sits at baseline strength; later words grow, but slower than plain ^n.
 */
export function wordPunchInScale(index: number, strength: number): number {
  return Math.pow(strength, Math.pow(index + 1, WORD_BY_WORD_TAPER));
}
