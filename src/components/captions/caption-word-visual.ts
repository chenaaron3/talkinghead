import type { CSSProperties } from "react";

import type {
  CaptionAnimation,
  CaptionBackdrop,
} from "../../lib/captions/style";
import { DEFAULT_HIGHLIGHT_COLOR } from "../../lib/captions/style";
import type { CaptionWord } from "../../lib/types";

import {
  EMPHASIS_COLORS,
  EMPHASIS_POP_SEC,
  wordFadeOpacity,
  wordPopScale,
} from "./caption-animation";

/** Resolved paint props for one caption word. */
export type CaptionWordVisual = {
  /** Typewriter omits unspoken words entirely (layout grows). */
  mount: boolean;
  color?: string;
  opacity: number;
  transform?: string;
  visibility: "visible" | "hidden";
};

export type ResolveCaptionWordVisualInput = {
  word: CaptionWord;
  index: number;
  frame: number;
  fps: number;
  groupEndFrame: number;
  fadeFrames: number;
  animation: CaptionAnimation;
  spoken: boolean;
  active: boolean;
  backdrop: CaptionBackdrop;
};

function scrapRotationDeg(index: number): number {
  return ((index * 37) % 13) - 6;
}

function scrapClipPath(index: number): string {
  const variants = [
    "polygon(2% 8%, 96% 3%, 100% 88%, 4% 97%)",
    "polygon(0% 12%, 98% 0%, 94% 100%, 3% 90%)",
    "polygon(4% 0%, 100% 6%, 97% 94%, 0% 100%)",
    "polygon(1% 5%, 100% 2%, 96% 100%, 0% 92%)",
  ];
  return variants[index % variants.length]!;
}

/** Pill / scrap chrome shared by render + template preview. */
export function captionWordBackdropStyle(
  backdrop: CaptionBackdrop,
  index: number,
): CSSProperties {
  if (backdrop === "scrap") {
    return {
      backgroundColor: "#FFFFFF",
      padding: "0.12em 0.28em",
      clipPath: scrapClipPath(index),
      boxDecorationBreak: "clone",
      WebkitBoxDecorationBreak: "clone",
    };
  }
  if (backdrop === "pill") {
    return {
      backgroundColor: "rgba(0, 0, 0, 0.78)",
      padding: "0.12em 0.4em",
      borderRadius: 999,
    };
  }
  return {};
}

/**
 * Map caption word + animation state → flat visual props.
 * Used by CaptionWordSpan and the inspector template preview.
 */
export function resolveCaptionWordVisual({
  word,
  index,
  frame,
  fps,
  groupEndFrame,
  fadeFrames,
  animation,
  spoken,
  active,
  backdrop,
}: ResolveCaptionWordVisualInput): CaptionWordVisual {
  if (animation === "typewriter" && !spoken) {
    return { mount: false, opacity: 0, visibility: "hidden" };
  }

  let color: string | undefined;
  let scale: number | undefined;
  let opacity = 1;
  let visibility: "visible" | "hidden" =
    spoken || animation === "karaoke" || animation === "typewriter"
      ? "visible"
      : "hidden";

  switch (animation) {
    case "karaoke":
      // Ahead words stay visible but dim; spoken words go full yellow.
      color = spoken ? DEFAULT_HIGHLIGHT_COLOR : undefined;
      opacity = spoken ? 1 : 0.35;
      if (active) scale = wordPopScale(frame, word, fps, EMPHASIS_POP_SEC);
      break;

    case "pop":
      if (spoken) scale = wordPopScale(frame, word, fps);
      break;

    case "fade":
      opacity = spoken
        ? wordFadeOpacity(frame, word, groupEndFrame, fadeFrames)
        : 0;
      break;

    case "none":
    case "typewriter":
      break;
  }

  // Emphasis color wins over karaoke yellow / default paint.
  if (word.emphasis) {
    color = EMPHASIS_COLORS[word.emphasis];
  }

  if (animation !== "karaoke" && !spoken) {
    opacity = 0;
  }

  const parts: string[] = [];
  if (scale != null) parts.push(`scale(${scale})`);
  if (backdrop === "scrap") parts.push(`rotate(${scrapRotationDeg(index)}deg)`);

  return {
    mount: true,
    color,
    opacity,
    transform: parts.length > 0 ? parts.join(" ") : undefined,
    visibility,
  };
}
