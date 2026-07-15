import type { SourceSfx } from "@src/lib/types";

import { MIN_RANGE_SEC } from "./range";

export function upsertSfx(
  sfx: SourceSfx[],
  clip: SourceSfx,
): SourceSfx[] | { error: string } {
  const others = sfx.filter((c) => c.id !== clip.id);
  if (clip.end <= clip.start) {
    return { error: "SFX end must be after start" };
  }
  const playDur = clip.end - clip.start;
  if (playDur > clip.srcDurationSec + 0.001) {
    return { error: "SFX range longer than source file" };
  }
  return [...others, clip].sort((a, b) => a.start - b.start);
}

export function removeSfx(sfx: SourceSfx[], id: string): SourceSfx[] {
  return sfx.filter((c) => c.id !== id);
}

/**
 * Start edge relocates playback (duration preserved).
 * End edge trims/extends play duration up to `srcDurationSec`.
 */
export function applySfxEdge(
  clip: SourceSfx,
  edge: "start" | "end",
  value: number,
  timelineDuration: number,
): SourceSfx {
  const maxPlay = Math.max(MIN_RANGE_SEC, clip.srcDurationSec);
  const playDur = Math.min(Math.max(MIN_RANGE_SEC, clip.end - clip.start), maxPlay);

  if (edge === "start") {
    let start = Math.max(0, Math.min(value, timelineDuration - MIN_RANGE_SEC));
    let end = start + playDur;
    if (end > timelineDuration) {
      end = timelineDuration;
      start = Math.max(0, end - playDur);
    }
    return { ...clip, start, end };
  }

  const end = Math.max(
    clip.start + MIN_RANGE_SEC,
    Math.min(value, clip.start + maxPlay, timelineDuration),
  );
  return { ...clip, end };
}
