import React from "react";
import { Sequence, staticFile, useVideoConfig } from "remotion";

import { Audio } from "@remotion/media";

const SFX_VOLUME = 0.4;

export const Sfx: React.FC<{
  src: string;
  from: number;
  durationSec: number;
  volume?: number;
}> = ({ src, from, durationSec, volume = SFX_VOLUME }) => {
  const { fps } = useVideoConfig();

  return (
    <Sequence from={from} durationInFrames={Math.ceil(durationSec * fps)}>
      <Audio src={staticFile(src)} volume={volume} />
    </Sequence>
  );
};
