import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

import { FADE_DURATION_SEC } from '../lib/episode/constants';
import { SfxOverlay } from './SfxOverlay';

import type { ListicleItem, ListicleOverlay } from "../lib/types";

const ACCENT = "#FFE600";
const CHECK_ANIM_SEC = 0.28;
const ROW_ENTER_SEC = 0.22;

const CARD_STYLE: React.CSSProperties = {
  width: "100%",
  maxWidth: "100%",
  backgroundColor: "rgba(255, 255, 255, 0.94)",
  borderRadius: 28,
  padding: "22px 28px",
  boxShadow: "0 10px 28px rgba(0, 0, 0, 0.35)",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  overflow: "hidden",
};

const ROW_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
  minHeight: 56,
  transformOrigin: "top center",
};

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: '"Montserrat", "Arial Black", Impact, sans-serif',
  fontWeight: 800,
  fontSize: 48,
  lineHeight: 1.15,
  color: "#111",
  letterSpacing: "-0.02em",
  margin: 0,
  flex: 1,
};

function fadeOpacity(
  frame: number,
  startFrame: number,
  endFrame: number,
  fadeFrames: number,
): number {
  const duration = Math.max(1, endFrame - startFrame);
  const local = frame - startFrame;
  const fade = Math.min(fadeFrames, Math.floor((duration - 1) / 2));
  if (fade <= 0) return 1;

  return interpolate(
    local,
    [0, fade, duration - fade, duration],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}

function CheckCircle({ progress }: { progress: number }) {
  const fill = interpolate(progress, [0, 0.45, 1], [0, 0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const check = interpolate(progress, [0.4, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(progress, [0, 0.55, 1], [0.85, 1.12, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const borderColor = fill > 0.35 ? ACCENT : "#B0B0B0";

  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        border: `3px solid ${borderColor}`,
        backgroundColor: `rgba(255, 230, 0, ${fill})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transform: `scale(${scale})`,
      }}
    >
      <svg width="26" height="26" viewBox="0 0 18 18" aria-hidden>
        <path
          d="M3.5 9.2 L7.2 12.8 L14.5 5.2"
          fill="none"
          stroke="#111"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="18"
          strokeDashoffset={18 * (1 - check)}
          opacity={check}
        />
      </svg>
    </div>
  );
}

function ListicleRow({
  item,
  frame,
  fps,
}: {
  item: ListicleItem;
  frame: number;
  fps: number;
}) {
  const local = frame - item.startFrame;
  const enterFrames = Math.max(1, Math.round(ROW_ENTER_SEC * fps));
  const checkFrames = Math.max(1, Math.round(CHECK_ANIM_SEC * fps));

  const enter = spring({
    frame: local,
    fps,
    config: { damping: 16, stiffness: 140, mass: 0.7 },
    durationInFrames: enterFrames + 6,
  });

  const checkProgress = interpolate(local, [0, checkFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const labelOpacity = interpolate(local, [0, enterFrames * 0.7], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        ...ROW_STYLE,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [12, 0])}px) scaleY(${interpolate(enter, [0, 1], [0.85, 1])})`,
      }}
    >
      <CheckCircle progress={checkProgress} />
      <p style={{ ...LABEL_STYLE, opacity: labelOpacity }}>
        {item.text}
      </p>
    </div>
  );
}

export const TikTokListicle: React.FC<{
  listicle: ListicleOverlay;
}> = ({ listicle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fadeFrames = Math.max(1, Math.round(FADE_DURATION_SEC * fps));

  // Rendered outside the visual's early returns so pops aren't cut short.
  const sfx = (
    <SfxOverlay
      sfx={listicle.items.map((item, index) => ({
        id: `listicle-${item.startFrame}-${index}`,
        src: "sfx/realistic/mouse_click.wav",
        startFrame: item.startFrame,
        endFrame: item.startFrame + Math.max(1, Math.ceil(0.2 * fps)),
      }))}
    />
  );

  if (frame < listicle.startFrame || frame >= listicle.endFrame) {
    return sfx;
  }

  const visibleItems = listicle.items.filter(
    (item) => frame >= item.startFrame,
  );
  if (visibleItems.length === 0) {
    return sfx;
  }

  const opacity = fadeOpacity(
    frame,
    listicle.startFrame,
    listicle.endFrame,
    fadeFrames,
  );

  return (
    <>
      {sfx}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          pointerEvents: "none",
          opacity,
        }}
      >
        <div style={CARD_STYLE}>
          {visibleItems.map((item, index) => (
            <ListicleRow
              key={`${item.startFrame}-${item.text}-${index}`}
              item={item}
              frame={frame}
              fps={fps}
            />
          ))}
        </div>
      </AbsoluteFill>
    </>
  );
};
