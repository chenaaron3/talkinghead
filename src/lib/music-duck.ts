import {
  MUSIC_DUCK_ATTACK_SEC,
  MUSIC_DUCK_BRIDGE_SEC,
  MUSIC_DUCK_RATIO,
  MUSIC_DUCK_RELEASE_SEC,
  MUSIC_FADE_IN_SEC,
  MUSIC_FADE_OUT_SEC,
  MUSIC_VOLUME_DEFAULT,
} from "./media";

export type DuckRegion = {
  startFrame: number;
  endFrame: number;
};

export type DuckRegionSec = {
  start: number;
  end: number;
};

export type MusicVolumeOptions = {
  frame: number;
  durationInFrames: number;
  fps: number;
  bedVolume?: number;
  duckRegions: readonly DuckRegion[];
  duckRatio?: number;
  attackSec?: number;
  releaseSec?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
};

/**
 * Merge [start, end) ranges, bridging gaps ≤ `bridge` in the same units.
 * Used for both frames and seconds.
 */
function mergeRanges<T extends { start: number; end: number }>(
  ranges: readonly T[],
  bridge: number,
): T[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges]
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);
  if (sorted.length === 0) return [];

  const out: T[] = [{ ...sorted[0]! }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const last = out[out.length - 1]!;
    if (cur.start <= last.end + bridge) {
      last.end = Math.max(last.end, cur.end);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** Merge duck regions on the output timeline (frames), bridging short gaps. */
export function mergeDuckRegions(
  regions: readonly DuckRegion[],
  bridgeFrames = 0,
): DuckRegion[] {
  return mergeRanges(
    regions.map((r) => ({ start: r.startFrame, end: r.endFrame })),
    bridgeFrames,
  ).map((r) => ({ startFrame: r.start, endFrame: r.end }));
}

/** Merge duck regions on the source timeline (seconds), bridging short gaps. */
export function mergeDuckRegionsSec(
  regions: readonly DuckRegionSec[],
  bridgeSec = MUSIC_DUCK_BRIDGE_SEC,
): DuckRegionSec[] {
  return mergeRanges(regions, bridgeSec);
}

/**
 * How strongly to duck at time `t` (0 = bed, 1 = fully ducked).
 * Attack into regions, release out of them. Units match `regions` / attack / release.
 */
function duckAmountAt(
  t: number,
  regions: readonly { start: number; end: number }[],
  attack: number,
  release: number,
): number {
  let amount = 0;

  for (const region of regions) {
    if (t < region.start) {
      const dist = region.start - t;
      if (dist < attack) {
        amount = Math.max(amount, 1 - dist / attack);
      }
    } else if (t < region.end) {
      amount = 1;
    } else {
      const dist = t - region.end;
      if (dist < release) {
        amount = Math.max(amount, 1 - dist / release);
      }
    }
    if (amount >= 1) return 1;
  }
  return amount;
}

/**
 * How strongly to duck at `frame` (0 = bed, 1 = fully ducked).
 * Attack into regions, release out of them.
 */
export function duckAmountAtFrame(
  frame: number,
  regions: readonly DuckRegion[],
  fps: number,
  attackSec = MUSIC_DUCK_ATTACK_SEC,
  releaseSec = MUSIC_DUCK_RELEASE_SEC,
): number {
  const attack = Math.max(1, Math.round(attackSec * fps));
  const release = Math.max(1, Math.round(releaseSec * fps));
  return duckAmountAt(
    frame,
    regions.map((r) => ({ start: r.startFrame, end: r.endFrame })),
    attack,
    release,
  );
}

/** Source-timeline twin of `duckAmountAtFrame` (seconds). */
export function duckAmountAtSec(
  sec: number,
  regions: readonly DuckRegionSec[],
  attackSec = MUSIC_DUCK_ATTACK_SEC,
  releaseSec = MUSIC_DUCK_RELEASE_SEC,
): number {
  return duckAmountAt(
    sec,
    regions,
    Math.max(1e-6, attackSec),
    Math.max(1e-6, releaseSec),
  );
}

/** Linear bed volume with ducking + edge fades for the composition. */
export function musicVolumeAtFrame(options: MusicVolumeOptions): number {
  const {
    frame,
    durationInFrames,
    fps,
    bedVolume = MUSIC_VOLUME_DEFAULT,
    duckRegions,
    duckRatio = MUSIC_DUCK_RATIO,
    attackSec = MUSIC_DUCK_ATTACK_SEC,
    releaseSec = MUSIC_DUCK_RELEASE_SEC,
    fadeInSec = MUSIC_FADE_IN_SEC,
    fadeOutSec = MUSIC_FADE_OUT_SEC,
  } = options;

  if (bedVolume <= 0 || durationInFrames <= 0) return 0;

  const duck = duckAmountAtFrame(
    frame,
    duckRegions,
    fps,
    attackSec,
    releaseSec,
  );
  const ducked = bedVolume * (1 - duck * (1 - duckRatio));

  const fadeInFrames = Math.max(1, Math.round(fadeInSec * fps));
  const fadeOutFrames = Math.max(1, Math.round(fadeOutSec * fps));
  let fade = 1;
  if (frame < fadeInFrames) {
    fade = Math.min(fade, frame / fadeInFrames);
  }
  const framesFromEnd = durationInFrames - 1 - frame;
  if (framesFromEnd < fadeOutFrames) {
    fade = Math.min(fade, Math.max(0, framesFromEnd / fadeOutFrames));
  }

  return Math.min(1, Math.max(0, ducked * fade));
}
