import React from "react";
import { Sequence, staticFile } from "remotion";

import { Audio } from "@remotion/media";

import type { SfxClip } from "../lib/types";

const SFX_VOLUME = 0.4;

export const SfxOverlay: React.FC<{ sfx?: SfxClip[] | null }> = ({ sfx }) => {
  if (!sfx?.length) return null;

  return (
    <>
      {sfx.map((clip) => {
        const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame);
        return (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={durationInFrames}
          >
            <Audio src={staticFile(clip.src)} volume={SFX_VOLUME} />
          </Sequence>
        );
      })}
    </>
  );
};
