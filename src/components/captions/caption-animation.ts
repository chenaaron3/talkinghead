import { interpolate } from "remotion";

import type { CaptionEmphasis, CaptionWord } from "../../lib/types";
import type { CaptionAnimation } from "../../lib/captions/style";

export const EMPHASIS_COLORS: Record<CaptionEmphasis, string> = {
  positive: "#00E676",
  negative: "#FF5252",
};

export const EMPHASIS_POP_SEC = 0.18;
export const POP_SEC = 0.18;
export const CURSOR_BLINK_FRAMES = 16;

export function wordFadeOpacity(
  frame: number,
  word: CaptionWord,
  groupEndFrame: number,
  fadeFrames: number,
): number {
  if (frame < word.startFrame) {
    return 0;
  }

  const local = frame - word.startFrame;
  const fadeIn = Math.min(
    fadeFrames,
    Math.max(1, word.endFrame - word.startFrame),
  );
  const fadeOutStart = Math.max(
    word.startFrame + fadeIn,
    groupEndFrame - fadeFrames,
  );
  const fadeOutLocal = fadeOutStart - word.startFrame;
  const groupLocalEnd = groupEndFrame - word.startFrame;

  if (local < fadeIn) {
    return interpolate(local, [0, fadeIn], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  if (frame >= fadeOutStart && groupLocalEnd > fadeOutLocal) {
    return interpolate(local, [fadeOutLocal, groupLocalEnd], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return 1;
}

export function wordPopScale(
  frame: number,
  word: CaptionWord,
  fps: number,
  durationSec = POP_SEC,
): number {
  const popFrames = Math.max(2, Math.round(durationSec * fps));
  return interpolate(
    frame - word.startFrame,
    [0, popFrames * 0.6, popFrames],
    [0.4, 1.25, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
}

export function lastVisibleWordIndex(
  words: CaptionWord[],
  frame: number,
  showAll: boolean,
): number {
  let last = -1;
  for (let i = 0; i < words.length; i++) {
    if (showAll || frame >= words[i]!.startFrame) last = i;
  }
  return last;
}

/** Shared blink phase for caption + title typewriter cursors. */
export function typewriterCursorBlink(frame: number): boolean {
  return Math.floor(frame / (CURSOR_BLINK_FRAMES / 2)) % 2 === 0;
}

export function typewriterCursorOn(
  animation: CaptionAnimation,
  lastVisibleIndex: number,
  frame: number,
  groupEndFrame: number,
): boolean {
  return (
    animation === "typewriter" &&
    lastVisibleIndex >= 0 &&
    frame < groupEndFrame &&
    typewriterCursorBlink(frame)
  );
}

/**
 * How many frames to spend revealing a title / free-text typewriter,
 * leaving room to read before the clip ends.
 */
export function typewriterTypeFrames(
  fps: number,
  durationFrames: number,
): number {
  const typeSec = Math.min(2.2, Math.max(0.8, durationFrames / fps - 1.2));
  return Math.max(1, Math.round(typeSec * fps));
}

/**
 * Split free text into per-character caption words staggered across
 * `typeFrames`, so titles can reuse {@link lastVisibleWordIndex} /
 * {@link typewriterCursorOn} like quote captions.
 */
export function typewriterCharWords(
  text: string,
  typeFrames: number,
  startFrame = 0,
): CaptionWord[] {
  if (text.length === 0) return [];
  const span = Math.max(1, typeFrames);
  return Array.from(text).map((ch, i) => {
    const t = text.length <= 1 ? 0 : i / (text.length - 1);
    const wordStart = startFrame + Math.floor(t * (span - 1));
    return {
      text: ch,
      startFrame: wordStart,
      endFrame: wordStart + 1,
    };
  });
}
