import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

import { FADE_DURATION_SEC } from '../lib/constants';
import { SfxOverlay } from './SfxOverlay';

const BOARD_STYLE: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  backgroundColor: "#FFE600",
  borderRadius: 24,
  padding: "28px 32px",
  boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const TITLE_STYLE: React.CSSProperties = {
  fontFamily: '"Montserrat", "Arial Black", Impact, sans-serif',
  fontWeight: 900,
  fontSize: 68,
  lineHeight: 1.1,
  color: "#111",
  textAlign: "center",
  textTransform: "uppercase",
  letterSpacing: "-0.015em",
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

  // Rendered outside the visual's early return so the exit tail can finish.
  const sfx = (
    <SfxOverlay
      sfx={[
        {
          id: "title-enter",
          src: "sfx/beep-bop/title-enter.wav",
          startFrame: 0,
          endFrame: Math.max(1, Math.ceil(0.35 * fps)),
        },
      ]}
    />
  );

  if (frame >= durationFrames) {
    return sfx;
  }

  const opacity = fadeOpacity(frame, durationFrames, fadeFrames);

  // Quick settle from slightly oversized: reads as a "stamp" without being busy.
  const enterFrames = Math.max(1, Math.round(0.2 * fps));
  const scale = interpolate(frame, [0, enterFrames], [1.08, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <>
      {sfx}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ ...BOARD_STYLE, opacity, transform: `scale(${scale})` }}>
          <h1 style={TITLE_STYLE}>{title}</h1>
        </div>
      </AbsoluteFill>
    </>
  );
};
