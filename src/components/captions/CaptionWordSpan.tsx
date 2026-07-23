import React from "react";

import type {
  CaptionAnimation,
  CaptionBackdrop,
} from "../../lib/captions/style";
import type { CaptionWord } from "../../lib/types";

import {
  captionWordBackdropStyle,
  resolveCaptionWordVisual,
} from "./caption-word-visual";

export type { CaptionWordVisual } from "./caption-word-visual";
export { resolveCaptionWordVisual } from "./caption-word-visual";

export const CaptionWordSpan: React.FC<{
  word: CaptionWord;
  index: number;
  frame: number;
  fps: number;
  groupEndFrame: number;
  fadeFrames: number;
  animation: CaptionAnimation;
  spoken: boolean;
  /** Karaoke: current word gets the pop; past words stay highlighted via `spoken`. */
  active?: boolean;
  showCursor: boolean;
  cursorColor: string;
  backdrop: CaptionBackdrop;
}> = ({
  word,
  index,
  frame,
  fps,
  groupEndFrame,
  fadeFrames,
  animation,
  spoken,
  active = false,
  showCursor,
  cursorColor,
  backdrop,
}) => {
  const visual = resolveCaptionWordVisual({
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
  });

  if (!visual.mount) return null;

  return (
    <span
      style={{
        display: "inline-block",
        visibility: visual.visibility,
        opacity: visual.opacity,
        color: visual.color,
        transform: visual.transform,
        ...captionWordBackdropStyle(backdrop, index),
      }}
    >
      {word.text}
      {showCursor ? (
        <span
          aria-hidden
          style={{
            display: "inline-block",
            marginLeft: "0.06em",
            width: "0.08em",
            minWidth: 3,
            height: "0.9em",
            backgroundColor: cursorColor,
            verticalAlign: "text-bottom",
          }}
        />
      ) : null}
    </span>
  );
};
