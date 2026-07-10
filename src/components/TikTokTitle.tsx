import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { FADE_DURATION_SEC } from '../lib/constants';

const TITLE_STYLE: React.CSSProperties = {
  fontFamily: '"Montserrat", "Arial Black", Impact, sans-serif',
  fontWeight: 900,
  fontSize: 72,
  lineHeight: 1.15,
  color: "#FFE600",
  textAlign: "center",
  textTransform: "uppercase",
  letterSpacing: "-0.02em",
  WebkitTextStroke: "10px #000",
  paintOrder: "stroke fill",
  textShadow: "0 0 1px #000",
  margin: 0,
  whiteSpace: "pre-line",
  maxWidth: "100%",
};

function fadeOpacity(
  localFrame: number,
  durationFrames: number,
  fadeFrames: number,
): number {
  const duration = Math.max(1, durationFrames);
  if (duration <= 2) {
    return 1;
  }

  const fade = Math.min(fadeFrames, Math.floor((duration - 1) / 2));
  if (fade <= 0) {
    return 1;
  }

  return interpolate(
    localFrame,
    [0, fade, duration - fade, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}

export const TikTokTitle: React.FC<{
  title: string;
  durationSec: number;
}> = ({ title, durationSec }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const durationFrames = Math.round(durationSec * fps);
  const fadeFrames = Math.max(1, Math.round(FADE_DURATION_SEC * fps));

  if (frame >= durationFrames) {
    return null;
  }

  const opacity = fadeOpacity(frame, durationFrames, fadeFrames);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <h1 style={{ ...TITLE_STYLE, opacity }}>{title}</h1>
    </AbsoluteFill>
  );
};
