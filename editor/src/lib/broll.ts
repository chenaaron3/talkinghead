import type { SourceBRoll, Transform } from "@src/lib/types";
import {
  VIDEO_BROLL_VOLUME_DEFAULT,
  isVideoSrc,
} from "@src/lib/media";

import { MIN_RANGE_SEC } from "./range";

export type { Transform };
export { isVideoSrc };

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

/** Max playable seconds given media offset (null = unlimited, e.g. images). */
export function bRollSrcDurationSec(clip: SourceBRoll): number | null {
  return "srcDurationSec" in clip ? clip.srcDurationSec : null;
}

export function maxBRollPlaySec(clip: SourceBRoll): number | null {
  const srcDur = bRollSrcDurationSec(clip);
  if (srcDur == null) return null;
  const offset = clip.mediaOffsetSec ?? 0;
  return Math.max(MIN_RANGE_SEC, srcDur - offset);
}

/** Write only non-default fields (omit identity in config.yaml). */
export function compactBRoll(clip: SourceBRoll): SourceBRoll {
  const next = resolveTransform(clip);
  const srcDur = bRollSrcDurationSec(clip);
  const base = {
    id: clip.id,
    src: clip.src,
    start: clip.start,
    end: clip.end,
    width: clip.width,
    height: clip.height,
  };
  const timed =
    isVideoSrc(clip.src) && srcDur != null
      ? { ...base, srcDurationSec: srcDur }
      : base;
  const out: SourceBRoll = { ...timed };
  if ((clip.mediaOffsetSec ?? 0) !== 0) {
    out.mediaOffsetSec = clip.mediaOffsetSec;
  }
  if ((clip.volume ?? VIDEO_BROLL_VOLUME_DEFAULT) !== VIDEO_BROLL_VOLUME_DEFAULT) {
    out.volume = clip.volume;
  }
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
  return compactBRoll({ ...clip, ...next });
}

export function withBRollMediaOffset(
  clip: SourceBRoll,
  mediaOffsetSec: number,
): SourceBRoll {
  const srcDur = bRollSrcDurationSec(clip);
  if (srcDur == null) return clip;
  const maxOffset = Math.max(0, srcDur - MIN_RANGE_SEC);
  const offset = Math.min(Math.max(0, mediaOffsetSec), maxOffset);
  const maxPlay = Math.max(MIN_RANGE_SEC, srcDur - offset);
  const play = clip.end - clip.start;
  const end = play > maxPlay ? clip.start + maxPlay : clip.end;
  return compactBRoll({
    ...clip,
    mediaOffsetSec: offset,
    end,
  });
}

export function withBRollVolume(clip: SourceBRoll, volume: number): SourceBRoll {
  const v = Math.min(1, Math.max(0, volume));
  return compactBRoll({ ...clip, volume: v });
}

export function clampBRollRange(
  clip: SourceBRoll,
  start: number,
  end: number,
): { start: number; end: number } {
  const maxPlay = maxBRollPlaySec(clip);
  if (maxPlay == null || end - start <= maxPlay + 0.001) {
    return { start, end };
  }
  // Prefer keeping whichever edge moved; fall back to keeping start.
  const startMoved = Math.abs(start - clip.start) >= Math.abs(end - clip.end);
  if (startMoved) {
    return { start: end - maxPlay, end };
  }
  return { start, end: start + maxPlay };
}

export function upsertBRoll(
  bRolls: SourceBRoll[],
  clip: SourceBRoll,
): SourceBRoll[] | { error: string } {
  const others = bRolls.filter((c) => c.id !== clip.id);
  if (clip.end <= clip.start) {
    return { error: "B-roll end must be after start" };
  }
  const maxPlay = maxBRollPlaySec(clip);
  if (maxPlay != null && clip.end - clip.start > maxPlay + 0.001) {
    return { error: "B-roll range longer than source media" };
  }
  return [...others, compactBRoll(clip)].sort((a, b) => a.start - b.start);
}

export function removeBRoll(bRolls: SourceBRoll[], id: string): SourceBRoll[] {
  return bRolls.filter((c) => c.id !== id);
}

/** True when playhead is inside the clip's source range. */
export function isBRollActiveAt(
  clip: Pick<SourceBRoll, "start" | "end">,
  sourceSec: number,
): boolean {
  return sourceSec >= clip.start && sourceSec < clip.end;
}
