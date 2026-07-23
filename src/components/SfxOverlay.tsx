import React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";

import { Audio } from "@remotion/media";

import { loudnessGainFor } from "../lib/audio/loudness";
import { SFX_VOLUME_DEFAULT } from "../lib/episode/media";
import type { AudioAsset, SfxClip } from "../lib/types";

export const SfxOverlay: React.FC<{ sfx?: SfxClip[] | null }> = ({ sfx }) => {
  if (!sfx?.length) return null;

  return (
    <>
      {sfx.map((clip) => {
        const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame);
        const volume =
          (clip.volume ?? SFX_VOLUME_DEFAULT) * loudnessGainFor(clip.src);
        return (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={durationInFrames}
          >
            <Audio src={staticFile(clip.src)} volume={volume} />
          </Sequence>
        );
      })}
    </>
  );
};

/** Play a single baked entrance SFX from the start of the current Sequence. */
export const SfxInsert: React.FC<{ sfx?: AudioAsset | null }> = ({ sfx }) => {
  const { fps } = useVideoConfig();
  if (!sfx) return null;
  return (
    <SfxOverlay
      sfx={[
        {
          id: "entrance",
          src: sfx.src,
          startFrame: 0,
          endFrame: Math.max(1, Math.ceil(sfx.srcDurationSec * fps)),
          volume: sfx.volume,
        },
      ]}
    />
  );
};
