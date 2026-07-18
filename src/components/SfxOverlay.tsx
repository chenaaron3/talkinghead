import React from "react";
import { Sequence, staticFile } from "remotion";

import { Audio } from "@remotion/media";

import { SFX_VOLUME_DEFAULT } from "../lib/media";
import type { SfxClip } from "../lib/types";

export const SfxOverlay: React.FC<{ sfx?: SfxClip[] | null }> = ({ sfx }) => {
  if (!sfx?.length) return null;

  return (
    <>
      {sfx.map((clip) => {
        const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame);
        const volume = clip.volume ?? SFX_VOLUME_DEFAULT;
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
