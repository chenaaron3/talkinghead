import type { CSSProperties } from "react";

import {
  mergeWordStyle,
  resolveCaptionFont,
  type CaptionGroupStyle,
  type WordStyle,
} from "../../lib/captions/style";
import { EMPHASIS_COLORS } from "./caption-animation";
import type { CaptionEmphasis } from "../../lib/types";

/** Group-level typography (color/stroke/shadow come from WordStyle). */
export function captionGroupCss(style: CaptionGroupStyle): CSSProperties {
  const font = resolveCaptionFont(style.fontFamily);
  return {
    fontFamily: font.family,
    fontWeight: font.weight,
    fontStyle: style.fontStyle,
    fontSize: style.fontSize,
    lineHeight: 1.2,
    textAlign: style.textAlign,
    textTransform: style.textTransform,
    letterSpacing: style.fontFamily === "montserrat" ? "-0.02em" : "0",
    margin: 0,
    maxWidth: "100%",
  };
}

/** Map a resolved WordStyle → CSS paint props. */
export function wordStyleToCss(wordStyle: WordStyle): CSSProperties {
  return {
    color: wordStyle.fill,
    opacity: wordStyle.opacity ?? 1,
    WebkitTextStroke: wordStyle.border
      ? `${wordStyle.border.width}px ${wordStyle.border.color}`
      : undefined,
    paintOrder: wordStyle.border ? "stroke fill" : undefined,
    textShadow: wordStyle.textShadow ?? undefined,
  };
}

export function resolveWordStyleForState(
  group: CaptionGroupStyle,
  state: "future" | "active" | "past",
): WordStyle {
  const base = group.wordStyle;
  if (state === "future") return mergeWordStyle(base, group.futureWordStyle);
  if (state === "past") return mergeWordStyle(base, group.pastWordStyle);
  return mergeWordStyle(base, group.activeWordStyle);
}

/** Lerp hex colors when both look like #RRGGBB. */
function lerpHex(a: string, b: string, t: number): string | null {
  const parse = (hex: string) => {
    const h = hex.trim();
    if (!/^#([0-9a-fA-F]{6})$/.test(h)) return null;
    return [
      Number.parseInt(h.slice(1, 3), 16),
      Number.parseInt(h.slice(3, 5), 16),
      Number.parseInt(h.slice(5, 7), 16),
    ] as const;
  };
  const A = parse(a);
  const B = parse(b);
  if (!A || !B) return null;
  const mix = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${mix(A[0], B[0])}${mix(A[1], B[1])}${mix(A[2], B[2])}`;
}

export function blendWordStyles(
  from: WordStyle,
  to: WordStyle,
  t: number,
): WordStyle {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const fill = lerpHex(from.fill, to.fill, t) ?? (t < 0.5 ? from.fill : to.fill);
  const fromOp = from.opacity ?? 1;
  const toOp = to.opacity ?? 1;
  return {
    fill,
    border: t < 0.5 ? from.border : to.border,
    background: t < 0.5 ? from.background : to.background,
    opacity: fromOp + (toOp - fromOp) * t,
    textShadow: t < 0.5 ? from.textShadow : to.textShadow,
  };
}

export function applyEmphasisFill(
  wordStyle: WordStyle,
  emphasis: CaptionEmphasis | undefined,
): WordStyle {
  if (!emphasis) return wordStyle;
  return { ...wordStyle, fill: EMPHASIS_COLORS[emphasis] };
}

/** @deprecated Use captionGroupCss — kept for any lingering imports. */
export function captionStyleToCss(style: CaptionGroupStyle): CSSProperties {
  return {
    ...captionGroupCss(style),
    ...wordStyleToCss(style.wordStyle),
  };
}
