import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { FADE_DURATION_SEC } from '../lib/constants';

import type { CaptionGroup, CaptionWord } from "../lib/types";

const CAPTION_STYLE: React.CSSProperties = {
  fontFamily: '"Montserrat", "Arial Black", Impact, sans-serif',
  fontWeight: 900,
  fontSize: 64,
  lineHeight: 1.2,
  color: "#FFE600",
  textAlign: "center",
  textTransform: "uppercase",
  letterSpacing: "-0.02em",
  WebkitTextStroke: "8px #000",
  paintOrder: "stroke fill",
  margin: 0,
  maxWidth: "100%",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
};

function wordOpacity(
  frame: number,
  word: CaptionWord,
  groupEndFrame: number,
  fadeFrames: number,
): number {
  if (frame < word.startFrame) {
    return 0;
  }

  const local = frame - word.startFrame;
  const fadeIn = Math.min(
    fadeFrames,
    Math.max(1, word.endFrame - word.startFrame),
  );
  const fadeOutStart = Math.max(
    word.startFrame + fadeIn,
    groupEndFrame - fadeFrames,
  );
  const fadeOutLocal = fadeOutStart - word.startFrame;
  const groupLocalEnd = groupEndFrame - word.startFrame;

  if (local < fadeIn) {
    return interpolate(local, [0, fadeIn], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  if (frame >= fadeOutStart && groupLocalEnd > fadeOutLocal) {
    return interpolate(local, [fadeOutLocal, groupLocalEnd], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return 1;
}

export const TikTokCaptions: React.FC<{
  groups: CaptionGroup[];
}> = ({ groups }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeFrames = Math.max(1, Math.round(FADE_DURATION_SEC * fps));

  const active = groups.find(
    (group) => frame >= group.startFrame && frame < group.endFrame,
  );

  if (!active) {
    return null;
  }

  // Always mount every word in the group so layout stays fixed;
  // unspoken words use visibility:hidden (keeps space, no reflow).
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <p
        style={{
          ...CAPTION_STYLE,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.35em",
        }}
      >
        {active.words.map((word, index) => {
          const spoken = frame >= word.startFrame;
          return (
            <span
              key={`${word.startFrame}-${word.text}-${index}`}
              style={{
                visibility: spoken ? "visible" : "hidden",
                opacity: spoken
                  ? wordOpacity(frame, word, active.endFrame, fadeFrames)
                  : 0,
                display: "inline-block",
              }}
            >
              {word.text}
            </span>
          );
        })}
      </p>
    </AbsoluteFill>
  );
};
