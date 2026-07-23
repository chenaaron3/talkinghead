import React from 'react';
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from 'remotion';

import {
  DEFAULT_PUNCH_IN_ANIMATE,
  DEFAULT_PUNCH_IN_WORD_BY_WORD,
  resolvePunchInOrigin,
  wordPunchInScale,
} from '../lib/visual/punchin';
import type { PunchInSegment } from '../lib/types';

/** Soft start/end for a full-range slow push-in. */
const SLOW_ZOOM_EASING = Easing.inOut(Easing.ease);

function singleScaleAtFrame(frame: number, punchIn: PunchInSegment): number {
  const { startFrame, endFrame, scale } = punchIn;
  const animate = punchIn.animate ?? DEFAULT_PUNCH_IN_ANIMATE;

  if (!animate) return scale;

  if (endFrame <= startFrame) return scale;

  return interpolate(frame, [startFrame, endFrame], [1, scale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SLOW_ZOOM_EASING,
  });
}

/** Word-by-word always hard-cuts between stepped scales (no animate). */
function wordByWordScaleAtFrame(
  frame: number,
  punchIn: PunchInSegment,
): number {
  const { scale, wordStartFrames } = punchIn;
  const starts = wordStartFrames;
  if (!starts || starts.length === 0) {
    return punchIn.scale;
  }

  let index = 0;
  for (let k = 1; k < starts.length; k++) {
    if (frame >= starts[k]!) index = k;
    else break;
  }

  return wordPunchInScale(index, scale);
}

function punchInAtFrame(
  frame: number,
  punchIns: PunchInSegment[],
): PunchInSegment | null {
  for (const punchIn of punchIns) {
    const { startFrame, endFrame } = punchIn;
    if (frame < startFrame || frame > endFrame) continue;
    return punchIn;
  }
  return null;
}

function scaleAtFrame(frame: number, punchIn: PunchInSegment): number {
  const wordByWord = punchIn.wordByWord ?? DEFAULT_PUNCH_IN_WORD_BY_WORD;
  if (wordByWord) return wordByWordScaleAtFrame(frame, punchIn);
  return singleScaleAtFrame(frame, punchIn);
}

export const PunchIn: React.FC<{
  punchIns: PunchInSegment[] | null | undefined;
  children: React.ReactNode;
}> = ({ punchIns, children }) => {
  const frame = useCurrentFrame();
  const active =
    punchIns && punchIns.length > 0 ? punchInAtFrame(frame, punchIns) : null;
  const scale = active ? scaleAtFrame(frame, active) : 1;
  const origin = resolvePunchInOrigin(active ?? {});

  return (
    <AbsoluteFill
      style={{
        transform: `scale(${scale})`,
        transformOrigin: `${origin.originX * 100}% ${origin.originY * 100}%`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
