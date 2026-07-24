import type { CSSProperties } from "react";

import {
  WORD_STATE_BLEND_SEC,
  type CaptionGroupStyle,
  type WordStyle,
} from "../../lib/captions/style";
import type { CaptionWord } from "../../lib/types";

import {
  resolveEnterExitMotion,
  wordStateBlendT,
  wordTypewriterCharStart,
  type CaptionMotion,
} from "./caption-animation";
import { backgroundChromeStyle, scrapRotationDeg } from "./CaptionBackground";
import {
  applyEmphasisFill,
  blendWordStyles,
  resolveWordStyleForState,
  wordStyleToCss,
} from "./caption-style-css";

export type CaptionWordVisual = {
  mount: boolean;
  opacity: number;
  transform?: string;
  wordCss: CSSProperties;
  backgroundCss: CSSProperties;
};

function motionTransform(
  motion: CaptionMotion,
  scrapIndex: number,
  scrap: boolean,
): string | undefined {
  const parts: string[] = [];
  if (motion.scale !== 1) parts.push(`scale(${motion.scale})`);
  if (motion.translateY !== 0) parts.push(`translateY(${motion.translateY}px)`);
  if (scrap) parts.push(`rotate(${scrapRotationDeg(scrapIndex)}deg)`);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function resolvePaintStyle(
  groupStyle: CaptionGroupStyle,
  word: CaptionWord,
  frame: number,
  fps: number,
  cycleStates: boolean,
): WordStyle {
  if (!cycleStates) {
    return applyEmphasisFill(
      resolveWordStyleForState(groupStyle, "active"),
      word.emphasis,
    );
  }

  const blend = wordStateBlendT(frame, word, fps, WORD_STATE_BLEND_SEC);
  const from = resolveWordStyleForState(groupStyle, blend.from);
  const to = resolveWordStyleForState(groupStyle, blend.to);
  const mixed = blendWordStyles(from, to, blend.t);
  return applyEmphasisFill(mixed, word.emphasis);
}

function hasWordStateDeltas(style: CaptionGroupStyle): boolean {
  return Boolean(
    style.pastWordStyle || style.futureWordStyle || style.activeWordStyle,
  );
}

/**
 * Paint + optional per-word enter/exit.
 * Typewriter letter reveal / cursor live in {@link CaptionWordSpan}.
 */
export function resolveCaptionWordVisual(input: {
  word: CaptionWord;
  index: number;
  frame: number;
  fps: number;
  groupEndFrame: number;
  groupStyle: CaptionGroupStyle;
  /** When true, apply groupStyle.animation enter/exit on this word. */
  animateWord: boolean;
  /** When true, cycle past/active/future (if deltas exist). */
  cycleWordStates: boolean;
}): CaptionWordVisual {
  const {
    word,
    index,
    frame,
    fps,
    groupEndFrame,
    groupStyle,
    animateWord,
    cycleWordStates,
  } = input;

  const cycleStates = cycleWordStates && hasWordStateDeltas(groupStyle);
  const paint = resolvePaintStyle(
    groupStyle,
    word,
    frame,
    fps,
    cycleStates,
  );
  const bg = paint.background;
  const scrap = bg?.kind === "scrap";
  const typewriter = groupStyle.animation === "typewriter";

  // Text / non-animated words: paint only (parent may own group motion).
  if (!animateWord) {
    if (typewriter && frame < word.startFrame) {
      return {
        mount: false,
        opacity: 0,
        wordCss: wordStyleToCss(paint),
        backgroundCss: {},
      };
    }
    return {
      mount: true,
      opacity: paint.opacity ?? 1,
      transform: scrap ? `rotate(${scrapRotationDeg(index)}deg)` : undefined,
      wordCss: wordStyleToCss({ ...paint, opacity: 1 }),
      backgroundCss: backgroundChromeStyle(bg, index),
    };
  }

  // Caption words: enter/exit on the word (typewriter uses letter reveal instead).
  const showUnspoken = cycleStates;
  if (frame < word.startFrame && !showUnspoken) {
    return {
      mount: false,
      opacity: 0,
      wordCss: wordStyleToCss(paint),
      backgroundCss: {},
    };
  }

  const motion =
    frame < word.startFrame && showUnspoken
      ? { opacity: 1, scale: 1, translateY: 0, mount: true }
      : resolveEnterExitMotion({
          animation: typewriter ? "none" : groupStyle.animation,
          frame,
          startFrame: word.startFrame,
          endFrame: groupEndFrame,
          fps,
        });

  if (!motion.mount) {
    return {
      mount: false,
      opacity: 0,
      wordCss: wordStyleToCss(paint),
      backgroundCss: {},
    };
  }

  return {
    mount: true,
    opacity: (paint.opacity ?? 1) * motion.opacity,
    transform: motionTransform(motion, index, scrap),
    wordCss: wordStyleToCss({ ...paint, opacity: 1 }),
    backgroundCss: backgroundChromeStyle(bg, index),
  };
}

/** Per-letter mount for caption typewriter (multi-char words). */
export function typewriterLetterVisible(
  word: CaptionWord,
  charIndex: number,
  charCount: number,
  frame: number,
): boolean {
  return frame >= wordTypewriterCharStart(word, charIndex, charCount);
}
