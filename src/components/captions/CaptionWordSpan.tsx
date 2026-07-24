import React from "react";

import type { CaptionGroupStyle } from "../../lib/captions/style";
import type { CaptionWord } from "../../lib/types";

import {
  lastVisibleWordIndex,
  typewriterCursorBlink,
} from "./caption-animation";
import {
  resolveCaptionWordVisual,
  typewriterLetterVisible,
} from "./caption-word-visual";

export type { CaptionWordVisual } from "./caption-word-visual";
export { resolveCaptionWordVisual } from "./caption-word-visual";

export const CaptionWordSpan: React.FC<{
  word: CaptionWord;
  index: number;
  words: CaptionWord[];
  frame: number;
  fps: number;
  groupEndFrame: number;
  groupStyle: CaptionGroupStyle;
  animateWord: boolean;
  cycleWordStates: boolean;
  /**
   * ContourBoard fill layer: keep layout glyphs, force transparent paint
   * (no fill/stroke/shadow/word background).
   */
  silhouette?: boolean;
}> = ({
  word,
  index,
  words,
  frame,
  fps,
  groupEndFrame,
  groupStyle,
  animateWord,
  cycleWordStates,
  silhouette = false,
}) => {
  const visual = resolveCaptionWordVisual({
    word,
    index,
    frame,
    fps,
    groupEndFrame,
    groupStyle,
    animateWord,
    cycleWordStates,
  });

  if (!visual.mount) return null;

  const whitespace = /^\s+$/.test(word.text);
  const typewriter = groupStyle.animation === "typewriter";
  const letterReveal = typewriter && word.text.length > 1 && !whitespace;

  const content = letterReveal
    ? Array.from(word.text).map((ch, i) => {
        if (!typewriterLetterVisible(word, i, word.text.length, frame)) {
          return null;
        }
        return <React.Fragment key={i}>{ch}</React.Fragment>;
      })
    : word.text;

  const showCursor =
    !silhouette &&
    typewriter &&
    frame < groupEndFrame &&
    lastVisibleWordIndex(words, frame, false) === index &&
    typewriterCursorBlink(frame);

  if (silhouette) {
    return (
      <span
        style={{
          display: "inline-block",
          whiteSpace: whitespace ? "pre" : undefined,
          opacity: visual.opacity > 0 ? 1 : 0,
          color: "transparent",
          WebkitTextFillColor: "transparent",
        }}
      >
        {content}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-block",
        whiteSpace: whitespace ? "pre" : undefined,
        opacity: visual.opacity,
        transform: visual.transform,
        ...visual.backgroundCss,
        ...visual.wordCss,
      }}
    >
      {content}
      {showCursor ? (
        <span
          aria-hidden
          style={{
            display: "inline-block",
            marginLeft: "0.06em",
            width: "0.08em",
            minWidth: 3,
            height: "0.9em",
            backgroundColor: groupStyle.wordStyle.fill,
            verticalAlign: "text-bottom",
          }}
        />
      ) : null}
    </span>
  );
};
