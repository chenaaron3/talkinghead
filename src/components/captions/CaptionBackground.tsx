import React, { type CSSProperties, type ReactNode } from "react";

import type { BackgroundStyle } from "../../lib/captions/style";

import { ContourBoard } from "./ContourBoard";

function scrapClipPath(index: number): string {
  const variants = [
    "polygon(2% 8%, 96% 3%, 100% 88%, 4% 97%)",
    "polygon(0% 12%, 98% 0%, 94% 100%, 3% 90%)",
    "polygon(4% 0%, 100% 6%, 97% 94%, 0% 100%)",
    "polygon(1% 5%, 100% 2%, 96% 100%, 0% 92%)",
  ];
  return variants[index % variants.length]!;
}

export function scrapRotationDeg(index: number): number {
  return ((index * 37) % 13) - 6;
}

/** CSS chrome for box / rounded / scrap. */
export function backgroundChromeStyle(
  background: BackgroundStyle | null | undefined,
  index = 0,
): CSSProperties {
  if (!background || background.kind === "none" || background.kind === "wrap") {
    return {};
  }

  const color = background.color?.trim();

  if (background.kind === "box") {
    const fill = color || "rgba(0, 0, 0, 0.82)";
    const board = Boolean(color);
    if (!board) {
      return {
        backgroundColor: fill,
        padding: "0.35em 0.55em",
        borderRadius: 8,
      };
    }
    return {
      backgroundColor: fill,
      borderRadius: 24,
      padding: "28px 32px",
      boxShadow: "0 6px 0 rgba(0, 0, 0, 0.35)",
    };
  }

  if (background.kind === "rounded") {
    return {
      backgroundColor: color || "rgba(0, 0, 0, 0.78)",
      padding: "0.12em 0.4em",
      borderRadius: 999,
    };
  }

  if (background.kind === "scrap") {
    return {
      backgroundColor: color || "#FFFFFF",
      padding: "0.12em 0.28em",
      clipPath: scrapClipPath(index),
      boxDecorationBreak: "clone",
      WebkitBoxDecorationBreak: "clone",
    };
  }

  return {};
}

/**
 * Shared background wrapper for group or word.
 * `wrap` → ContourBoard (inline line boxes + goo); other kinds → CSS chrome.
 */
export const CaptionBackground: React.FC<{
  background: BackgroundStyle | null | undefined;
  index?: number;
  style?: CSSProperties;
  /** Typography for ContourBoard fill/text flow (wrap only). */
  textStyle?: CSSProperties;
  textAlign?: "left" | "center" | "right";
  children: ReactNode;
}> = ({
  background,
  index = 0,
  style,
  textStyle,
  textAlign = "center",
  children,
}) => {
  if (background?.kind === "wrap") {
    return (
      <ContourBoard
        fill={background.color?.trim() || "#FFFFFF"}
        textAlign={textAlign}
        textStyle={textStyle ?? {}}
      >
        {children}
      </ContourBoard>
    );
  }

  const chrome = backgroundChromeStyle(background, index);
  const scrap =
    background?.kind === "scrap"
      ? { transform: `rotate(${scrapRotationDeg(index)}deg)` }
      : {};

  if (!background || background.kind === "none") {
    if (!style) return <>{children}</>;
    return <span style={style}>{children}</span>;
  }

  return (
    <span
      style={{
        display: "inline-block",
        ...chrome,
        ...scrap,
        ...style,
      }}
    >
      {children}
    </span>
  );
};
