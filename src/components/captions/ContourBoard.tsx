import React, { useId, type CSSProperties, type ReactNode } from "react";

import {
  CONTOUR_LINE_HEIGHT,
  CONTOUR_PAD_X_EM,
  CONTOUR_PAD_Y_EM,
  CONTOUR_RADIUS_EM,
  type ContourLine,
} from "./contour-board";

/**
 * Merged sticker silhouette: one centered pill per line, goo-blended.
 * Explicit lines (not inline wrap) keep L/R padding equal.
 */
export const ContourBoard: React.FC<{
  fill: string;
  textAlign: "left" | "center";
  textStyle: CSSProperties;
  lines: ContourLine[];
  renderLine: (line: ContourLine) => ReactNode;
}> = ({ fill, textAlign, textStyle, lines, renderLine }) => {
  const rawId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const filterId = `contour-goo-${rawId}`;

  const lineChrome: CSSProperties = {
    ...textStyle,
    display: "inline-block",
    padding: `${CONTOUR_PAD_Y_EM}em ${CONTOUR_PAD_X_EM}em`,
    borderRadius: `${CONTOUR_RADIUS_EM}em`,
    lineHeight: CONTOUR_LINE_HEIGHT,
    maxWidth: "100%",
    textAlign: "center",
    margin: 0,
    width: "auto",
    boxSizing: "border-box",
  };

  const alignItems = textAlign === "left" ? "flex-start" : "center";

  const paintLines = (painted: boolean) =>
    lines.map((line, i) => (
      <span
        key={`contour-line-${painted ? "fill" : "text"}-${i}`}
        style={{
          ...lineChrome,
          backgroundColor: painted ? fill : "transparent",
          color: painted ? "transparent" : textStyle.color,
          WebkitTextFillColor: painted ? "transparent" : undefined,
          WebkitTextStroke: painted ? undefined : textStyle.WebkitTextStroke,
          textShadow: painted ? undefined : textStyle.textShadow,
        }}
      >
        {renderLine(line)}
      </span>
    ));

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <svg
        width={0}
        height={0}
        aria-hidden
        style={{ position: "absolute", overflow: "hidden" }}
      >
        <defs>
          <filter
            id={filterId}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur
              in="SourceGraphic"
              stdDeviation="8"
              result="blur"
            />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
              result="goo"
            />
          </filter>
        </defs>
      </svg>

      <div
        aria-hidden
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems,
          width: "100%",
          filter: `url(#${filterId})`,
        }}
      >
        {paintLines(true)}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          display: "flex",
          flexDirection: "column",
          alignItems,
          width: "100%",
        }}
      >
        {paintLines(false)}
      </div>
    </div>
  );
};
