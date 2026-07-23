import { MUSIC_VOLUME_DEFAULT } from "@src/lib/episode/media";
import type { SourceMusic } from "@src/lib/types";

export type MusicAsset = {
  key: string;
  label: string;
  src: string;
  durationSec: number;
};

export function compactMusic(clip: SourceMusic): SourceMusic {
  const out: SourceMusic = {
    id: clip.id,
    src: clip.src,
    srcDurationSec: clip.srcDurationSec,
  };
  if ((clip.volume ?? MUSIC_VOLUME_DEFAULT) !== MUSIC_VOLUME_DEFAULT) {
    out.volume = clip.volume;
  }
  if (clip.mediaOffsetSec != null && clip.mediaOffsetSec > 0) {
    out.mediaOffsetSec = clip.mediaOffsetSec;
  }
  return out;
}

export function musicFromAsset(asset: MusicAsset): SourceMusic {
  return compactMusic({
    id: "music",
    src: asset.src,
    srcDurationSec: Math.max(0.04, asset.durationSec),
  });
}

export function withMusicVolume(clip: SourceMusic, volume: number): SourceMusic {
  return compactMusic({
    ...clip,
    volume: Math.min(1, Math.max(0, volume)),
  });
}

export function withMusicOffset(
  clip: SourceMusic,
  mediaOffsetSec: number,
): SourceMusic {
  const max = Math.max(0, clip.srcDurationSec - 0.04);
  return compactMusic({
    ...clip,
    mediaOffsetSec: Math.min(max, Math.max(0, mediaOffsetSec)),
  });
}
