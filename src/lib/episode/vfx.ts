import type { AudioAsset, HasSFX } from "./config-types";
import { DEFAULT_TEXT_ENTRANCE_SFX } from "./config-types";
import { SFX_VOLUME_DEFAULT } from "./media";

/** Compact entrance SFX for YAML (omit identity volume). */
export function compactEntranceSfx(sfx: AudioAsset): AudioAsset {
  const out: AudioAsset = {
    src: sfx.src,
    srcDurationSec: sfx.srcDurationSec,
  };
  if ((sfx.volume ?? SFX_VOLUME_DEFAULT) !== SFX_VOLUME_DEFAULT) {
    out.volume = sfx.volume;
  }
  return out;
}

/**
 * Set entrance SFX on any {@link HasSFX} clip.
 * Pass `null` to clear (omit); omit / null both mean silent at render.
 */
export function withSfx<T extends HasSFX>(
  clip: T,
  sfx: AudioAsset | null,
): T {
  if (!sfx) {
    const next = { ...clip };
    delete next.sfx;
    return next;
  }
  return { ...clip, sfx: compactEntranceSfx(sfx) };
}

/** Remove the `sfx` field (omit from config). */
export function withoutSfx<T extends HasSFX>(clip: T): T {
  return withSfx(clip, null);
}

/**
 * Update entrance SFX volume on any {@link HasSFX} clip.
 * No-op when `sfx` is missing or null (silent).
 */
export function withSfxVolume<T extends HasSFX>(
  clip: T,
  volume: number,
): T {
  if (!clip.sfx) return clip;
  const v = Math.min(1, Math.max(0, volume));
  return withSfx(clip, { ...clip.sfx, volume: v });
}

/** Seed used when creating a new text VFX. */
export function defaultTextEntranceSfx(hostDurationSec: number): AudioAsset {
  return {
    src: DEFAULT_TEXT_ENTRANCE_SFX,
    srcDurationSec: Math.max(0.05, hostDurationSec),
  };
}
