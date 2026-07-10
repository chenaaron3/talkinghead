import React, { useMemo } from "react";
import { AbsoluteFill, staticFile, useVideoConfig } from "remotion";
import { Video } from "@remotion/media";
import { SAFE_AREA } from "./lib/constants";
import type { EpisodeProps } from "./lib/types";

const FONT_FAMILY = '"Montserrat", "Arial Black", Impact, sans-serif';
const MAX_FONT_SIZE = 110;
const MIN_FONT_SIZE = 36;
const STROKE_PX = 12;

function parsePercent(value: string): number {
  return Number.parseFloat(value) / 100;
}

function fitFontSize(text: string, maxWidthPx: number): number {
  if (typeof document === "undefined") {
    return MAX_FONT_SIZE;
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return MAX_FONT_SIZE;
  }

  const lines = text
    .split(/\n/)
    .flatMap((line) => line.trim().split(/\s+/))
    .filter(Boolean)
    .map((line) => line.toUpperCase());

  for (let size = MAX_FONT_SIZE; size >= MIN_FONT_SIZE; size -= 2) {
    ctx.font = `900 ${size}px ${FONT_FAMILY}`;
    const widest = Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
    // Stroke paints outside the glyph; keep it inside the safe box.
    if (widest + STROKE_PX * 2 <= maxWidthPx) {
      return size;
    }
  }

  return MIN_FONT_SIZE;
}

/** Single-frame cover: first edited frame + large centered title. */
export const Cover: React.FC<EpisodeProps> = ({ title, videoSrc, sections }) => {
  const { width } = useVideoConfig();
  const first = sections[0];

  const contentWidth =
    width * (1 - parsePercent(SAFE_AREA.left) - parsePercent(SAFE_AREA.right));
  const fontSize = useMemo(
    () => fitFontSize(title, contentWidth),
    [title, contentWidth],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {first ? (
        <Video
          src={staticFile(videoSrc)}
          trimBefore={first.trimBefore}
          trimAfter={Math.min(first.trimAfter, first.trimBefore + 1)}
          objectFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      ) : null}

      <AbsoluteFill
        style={{
          top: SAFE_AREA.top,
          bottom: SAFE_AREA.bottom,
          left: SAFE_AREA.left,
          right: SAFE_AREA.right,
          width: "auto",
          height: "auto",
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <h1
          style={{
            fontFamily: FONT_FAMILY,
            fontWeight: 900,
            fontSize,
            lineHeight: 1.1,
            color: "#FFE600",
            textAlign: "center",
            textTransform: "uppercase",
            letterSpacing: "-0.02em",
            WebkitTextStroke: `${STROKE_PX}px #000`,
            paintOrder: "stroke fill",
            textShadow: "0 0 1px #000",
            margin: 0,
            whiteSpace: "pre-line",
            maxWidth: "100%",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {title}
        </h1>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
