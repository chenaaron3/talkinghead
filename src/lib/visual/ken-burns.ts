/** Ken Burns end-scale multiplier on transform `scale` (start). */

export const DEFAULT_KEN_BURNS = 1.15;
export const KEN_BURNS_MIN = 0.5;
export const KEN_BURNS_MAX = 2;

export function clampKenBurns(multiplier: number): number {
  return Math.min(KEN_BURNS_MAX, Math.max(KEN_BURNS_MIN, multiplier));
}

/**
 * Resolved end-scale multiplier, or `null` when disabled (unset in config).
 */
export function resolveKenBurns(
  kenBurns: number | undefined,
): number | null {
  if (kenBurns == null) return null;
  return clampKenBurns(kenBurns);
}
