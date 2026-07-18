import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

import {
  DEFAULT_PUNCH_IN_ANIMATE,
  DEFAULT_PUNCH_IN_WORD_BY_WORD,
  wordPunchInScale,
} from '../lib/punchin';
import type { PunchInSegment } from '../lib/types';

const ENTER_FRAMES = 4;
const EXIT_FRAMES = 8;

// Faces sit above center in 9:16 talking-head framing.
const TRANSFORM_ORIGIN = "50% 35%";

const EASING = Easing.inOut(Easing.ease);

function singleScaleAtFrame(frame: number, punchIn: PunchInSegment): number {
  const { startFrame, endFrame, scale } = punchIn;
  const animate = punchIn.animate ?? DEFAULT_PUNCH_IN_ANIMATE;

  if (!animate) return scale;

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

function wordByWordScaleAtFrame(
  frame: number,
  punchIn: PunchInSegment,
): number {
  const { endFrame, scale, wordStartFrames } = punchIn;
  const animate = punchIn.animate ?? DEFAULT_PUNCH_IN_ANIMATE;
  const starts = wordStartFrames;
  if (!starts || starts.length === 0) {
    return singleScaleAtFrame(frame, punchIn);
  }

  const n = starts.length;
  const scaleAt = (index: number) => wordPunchInScale(index, scale);
  const lastScale = scaleAt(n - 1);

  if (animate) {
    const exitStart = endFrame - EXIT_FRAMES;
    if (exitStart > starts[n - 1]! && frame >= exitStart) {
      return interpolate(frame, [exitStart, endFrame], [lastScale, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: EASING,
      });
    }
  }

  let index = 0;
  for (let k = 1; k < n; k++) {
    if (frame >= starts[k]!) index = k;
    else break;
  }

  const target = scaleAt(index);
  if (!animate) return target;

  const prev = index === 0 ? 1 : scaleAt(index - 1);
  const segStart = starts[index]!;
  const segEnd = index + 1 < n ? starts[index + 1]! : endFrame;
  const enterEnd = Math.min(segStart + ENTER_FRAMES, segEnd);
  if (enterEnd <= segStart) return target;

  return interpolate(frame, [segStart, enterEnd], [prev, target], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASING,
  });
}

function scaleAtFrame(frame: number, punchIns: PunchInSegment[]): number {
  for (const punchIn of punchIns) {
    const { startFrame, endFrame } = punchIn;
    if (frame < startFrame || frame > endFrame) continue;

    const wordByWord = punchIn.wordByWord ?? DEFAULT_PUNCH_IN_WORD_BY_WORD;
    if (wordByWord) return wordByWordScaleAtFrame(frame, punchIn);
    return singleScaleAtFrame(frame, punchIn);
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
