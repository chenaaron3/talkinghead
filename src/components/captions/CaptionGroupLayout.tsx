import React, {
  Children,
  type CSSProperties,
  type ReactNode,
} from "react";

import { DEFAULT_CAPTION_STYLE } from "../../lib/captions/style";
import type { CaptionGroup } from "../../lib/types";

import { CaptionBackground } from "./CaptionBackground";
import { captionGroupCss } from "./caption-style-css";

function rowJustify(
  textAlign: "left" | "center" | "right",
): CSSProperties["justifyContent"] {
  if (textAlign === "left") return "flex-start";
  if (textAlign === "right") return "flex-end";
  return "center";
}

export type CaptionGroupLayoutProps = {
  group: CaptionGroup;
  /** Outer transform/opacity (e.g. group enter/exit). */
  shellStyle?: CSSProperties;
  children: ReactNode;
};

/**
 * Shared caption shell: safe-area Y, background, word row.
 * Motion policy and word paint live in the calling view (as children).
 */
export const CaptionGroupLayout: React.FC<CaptionGroupLayoutProps> = ({
  group,
  shellStyle,
  children,
}) => {
  const style = group.style ?? DEFAULT_CAPTION_STYLE;
  const background = style.background;
  const textAlign = style.textAlign;
  const wrap = background.kind === "wrap";
  const baseText = captionGroupCss(style);
  const textStyle: CSSProperties = {
    ...baseText,
    color: style.wordStyle.fill,
  };
  const gap =
    style.wordStyle.background?.kind === "scrap" ||
    style.wordStyle.background?.kind === "rounded"
      ? "0.45em 0.55em"
      : "0.35em";

  // ContourBoard needs inline line boxes — insert spaces between word children.
  const content = wrap
    ? Children.toArray(children).flatMap((child, i) =>
        i === 0 ? [child] : [" ", child],
      )
    : children;

  const innerStyle: CSSProperties = wrap
    ? {
        ...textStyle,
        width: "100%",
        maxWidth: "100%",
      }
    : {
        ...textStyle,
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: rowJustify(textAlign),
        gap,
        width: background.kind === "box" ? "auto" : "100%",
        maxWidth: "100%",
      };

  return (
    <div
      style={{
        position: "absolute",
        top: `${style.y * 100}%`,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: rowJustify(textAlign),
        transform: "translateY(-50%)",
        ...shellStyle,
      }}
    >
      <CaptionBackground
        background={background}
        textAlign={textAlign}
        textStyle={textStyle}
        style={innerStyle}
      >
        {content}
      </CaptionBackground>
    </div>
  );
};
