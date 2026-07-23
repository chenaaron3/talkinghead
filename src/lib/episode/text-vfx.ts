import type { SourceTextVfx, SourceVfx } from "./config-types";

/**
 * Title-linked intro overlay: earliest text VFX that starts before `beforeSec`
 * (typically the first spoken word). Not limited to `start === 0` — clips are
 * often nudged slightly later on the timeline.
 */
export function findIntroTextVfx(
  vfx: SourceVfx[],
  beforeSec: number,
): SourceTextVfx | undefined {
  let best: SourceTextVfx | undefined;
  for (const clip of vfx) {
    if (clip.type !== "text") continue;
    if (clip.start >= beforeSec) continue;
    if (!best || clip.start < best.start) best = clip;
  }
  return best;
}
