import React from "react";
import { Sequence, staticFile } from "remotion";

import { Audio } from "@remotion/media";

import { loudnessGainFor } from "../lib/audio/loudness";
import { SFX_VOLUME_DEFAULT } from "../lib/episode/media";
import type { SfxClip } from "../lib/types";

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
