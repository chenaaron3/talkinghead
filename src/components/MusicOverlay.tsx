import React, { useMemo } from "react";
import { staticFile, useVideoConfig } from "remotion";

import { Audio } from "@remotion/media";

import { loudnessGainFor } from "../lib/audio/loudness";
import { MUSIC_DUCK_BRIDGE_SEC, MUSIC_VOLUME_DEFAULT } from "../lib/episode/media";
import { mergeDuckRegions, musicVolumeAtFrame } from "../lib/audio/music-duck";
import type { CaptionGroup, MusicClip, SfxClip } from "../lib/types";

function regionsFromCaptions(groups: CaptionGroup[] | null | undefined) {
  const out: Array<{ startFrame: number; endFrame: number }> = [];
  for (const group of groups ?? []) {
    for (const word of group.words) {
      if (word.endFrame > word.startFrame) {
        out.push({ startFrame: word.startFrame, endFrame: word.endFrame });
      }
    }
  }
  return out;
}

function regionsFromSfx(sfx: SfxClip[] | null | undefined) {
  return (sfx ?? [])
    .filter((clip) => clip.endFrame > clip.startFrame)
    .map((clip) => ({
      startFrame: clip.startFrame,
      endFrame: clip.endFrame,
    }));
}

export const MusicOverlay: React.FC<{
  music?: MusicClip | null;
  captionGroups?: CaptionGroup[] | null;
  sfx?: SfxClip[] | null;
}> = ({ music, captionGroups, sfx }) => {
  const { fps, durationInFrames } = useVideoConfig();

  const duckRegions = useMemo(
    () =>
      mergeDuckRegions(
        [
          ...regionsFromCaptions(captionGroups),
          ...regionsFromSfx(sfx),
        ],
        Math.round(MUSIC_DUCK_BRIDGE_SEC * fps),
      ),
    [captionGroups, sfx, fps],
  );

  if (!music) return null;

  const bedVolume =
    (music.volume ?? MUSIC_VOLUME_DEFAULT) * loudnessGainFor(music.src);
  const trimBefore =
    music.mediaOffsetSec != null && music.mediaOffsetSec > 0
      ? Math.round(music.mediaOffsetSec * fps)
      : undefined;

  return (
    <Audio
      src={staticFile(music.src)}
      loop
      loopVolumeCurveBehavior="extend"
      trimBefore={trimBefore}
      volume={(frame) =>
        musicVolumeAtFrame({
          frame,
          durationInFrames,
          fps,
          bedVolume,
          duckRegions,
        })
      }
    />
  );
};
