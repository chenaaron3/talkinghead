export const PUNCH_IN_STRENGTH = {
  light: 1.06,
  medium: 1.12,
  strong: 1.2,
} as const;

export type PunchInStrength = keyof typeof PUNCH_IN_STRENGTH;

export const DEFAULT_PUNCH_IN_SCALE = PUNCH_IN_STRENGTH.medium;
export const DEFAULT_PUNCH_IN_ANIMATE = true;
export const DEFAULT_PUNCH_IN_WORD_BY_WORD = false;

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
const WORD_BY_WORD_TAPER = 0.7;

/**
 * Root-damped geometric: strength^((index+1)^taper).
 * First word sits at baseline strength; later words grow, but slower than plain ^n.
 */
export function wordPunchInScale(index: number, strength: number): number {
  return Math.pow(strength, Math.pow(index + 1, WORD_BY_WORD_TAPER));
}
