/** File-extension helpers and shared media defaults (no Node deps). */

const VIDEO_EXT = /\.(mp4|mov|webm)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export const SFX_VOLUME_DEFAULT = 0.4;
export const VIDEO_BROLL_VOLUME_DEFAULT = 0;

export function isVideoSrc(src: string): boolean {
  return VIDEO_EXT.test(src);
}

export function isImageSrc(src: string): boolean {
  return IMAGE_EXT.test(src);
}
