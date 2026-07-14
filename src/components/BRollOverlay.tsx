import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import type { BRollClip } from "../lib/types";

const FADE_SEC = 0.12;

const Clip: React.FC<{ clip: BRollClip }> = ({ clip }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = Math.max(1, clip.endFrame - clip.startFrame);
  const fade = Math.max(1, Math.round(FADE_SEC * fps));
  const opacity =
    duration <= fade * 2
      ? 1
      : interpolate(
          frame,
          [0, fade, duration - fade, duration],
          [1, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity,
      }}
    >
      <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.55)" }} />
      <Img
        src={staticFile(clip.src)}
        style={{
          position: "relative",
          maxWidth: "92%",
          maxHeight: "70%",
          width: "auto",
          height: "auto",
          objectFit: "contain",
          borderRadius: 16,
          zIndex: 1,
        }}
      />
    </AbsoluteFill>
  );
};

export const BRollOverlay: React.FC<{ bRolls?: BRollClip[] | null }> = ({
  bRolls,
}) => {
  if (!bRolls?.length) return null;

  return (
    <>
      {bRolls.map((clip) => {
        const durationInFrames = Math.max(1, clip.endFrame - clip.startFrame);
        return (
          <Sequence
            key={clip.id}
            from={clip.startFrame}
            durationInFrames={durationInFrames}
          >
            <Clip clip={clip} />
          </Sequence>
        );
      })}
    </>
  );
};
