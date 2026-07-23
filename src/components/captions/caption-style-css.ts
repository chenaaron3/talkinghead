import type { CSSProperties } from "react";

import {
  resolveCaptionFont,
  type CaptionStyle,
} from "../../lib/captions/style";

/** Map CaptionStyle → Remotion/CSS text styles. */
export function captionStyleToCss(style: CaptionStyle): CSSProperties {
  const font = resolveCaptionFont(style.fontFamily);
  return {
    fontFamily: font.family,
    fontWeight: font.weight,
    fontSize: style.fontSize,
    lineHeight: 1.2,
    color: style.color,
    textAlign: "center",
    textTransform: style.textTransform,
    letterSpacing: style.fontFamily === "montserrat" ? "-0.02em" : "0",
    WebkitTextStroke: style.stroke
      ? `${style.stroke.width}px ${style.stroke.color}`
      : undefined,
    paintOrder: style.stroke ? "stroke fill" : undefined,
    textShadow: style.shadow
      ? "0 3px 0 #000, 0 6px 16px rgba(0,0,0,0.85)"
      : undefined,
    margin: 0,
    maxWidth: "100%",
  };
}
