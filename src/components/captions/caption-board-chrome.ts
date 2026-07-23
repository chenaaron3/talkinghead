import type { CSSProperties } from "react";

import type { CaptionStyle } from "../../lib/captions/style";

export function boardFill(style: CaptionStyle): string | null {
  const fill = style.backdropColor?.trim();
  return fill ? fill : null;
}

/** Rectangular stamp / translucent box behind a caption group. */
export function boxChrome(style: CaptionStyle): CSSProperties {
  const fill = boardFill(style) || "rgba(0, 0, 0, 0.82)";
  const board = boardFill(style) != null;
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
