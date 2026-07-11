import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

import type { PunchInSegment } from '../lib/types';

const ENTER_FRAMES = 4;
const EXIT_FRAMES = 8;

// Faces sit above center in 9:16 talking-head framing.
const TRANSFORM_ORIGIN = "50% 35%";

const EASING = Easing.inOut(Easing.ease);

function scaleAtFrame(frame: number, punchIns: PunchInSegment[]): number {
  for (const punchIn of punchIns) {
    const { startFrame, endFrame, scale } = punchIn;
    if (frame < startFrame || frame > endFrame) continue;

    const enterEnd = startFrame + ENTER_FRAMES;
    const exitStart = endFrame - EXIT_FRAMES;

    if (enterEnd < exitStart) {
      return interpolate(
        frame,
        [startFrame, enterEnd, exitStart, endFrame],
        [1, scale, scale, 1],
        {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: EASING,
        },
      );
    }

    // Too short for a hold: ramp up to the midpoint, then straight back down.
    const midFrame = (startFrame + endFrame) / 2;
    return interpolate(
      frame,
      [startFrame, midFrame, endFrame],
      [1, scale, 1],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASING,
      },
    );
  }
  return 1;
}

export const PunchIn: React.FC<{
  punchIns: PunchInSegment[] | null | undefined;
  children: React.ReactNode;
}> = ({ punchIns, children }) => {
  const frame = useCurrentFrame();
  const scale =
    punchIns && punchIns.length > 0 ? scaleAtFrame(frame, punchIns) : 1;

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: TRANSFORM_ORIGIN,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
