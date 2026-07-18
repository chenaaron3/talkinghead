/** File-extension helpers and shared media defaults (no Node deps). */

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export const SFX_VOLUME_DEFAULT = 0.4;
export const VIDEO_BROLL_VOLUME_DEFAULT = 0;
/** Bed level ≈ −16 dB relative to dialogue at 1.0. */
export const MUSIC_VOLUME_DEFAULT = 0.15;
/** Multiply bed volume while captions/SFX are active. */
export const MUSIC_DUCK_RATIO = 0.5;
export const MUSIC_DUCK_ATTACK_SEC = 0.12;
export const MUSIC_DUCK_RELEASE_SEC = 0.45;
/** Keep ducked across gaps shorter than this (speech presence). */
export const MUSIC_DUCK_BRIDGE_SEC = 0.35;
export const MUSIC_FADE_IN_SEC = 0.5;
export const MUSIC_FADE_OUT_SEC = 1;

export function isVideoSrc(src: string): boolean {
  return VIDEO_EXT.test(src);
}

export function isImageSrc(src: string): boolean {
  return IMAGE_EXT.test(src);
}
