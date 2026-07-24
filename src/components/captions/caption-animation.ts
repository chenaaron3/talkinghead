import { interpolate } from "remotion";

import {
  CAPTION_ENTER_SEC,
  TYPEWRITER_CHAR_DELAY_SEC,
} from "../../lib/captions/style";

import type { CaptionAnimation } from "../../lib/captions/style";

import type { CaptionEmphasis, CaptionWord } from "../../lib/types";
export const EMPHASIS_COLORS: Record<CaptionEmphasis, string> = {
  positive: "#00E676",
  negative: "#FF5252",
};

export const CURSOR_BLINK_FRAMES = 16;
export const SLIDE_OFFSET_PX = 28;

export type CaptionMotion = {
  opacity: number;
  scale: number;
  translateY: number;
  /** Typewriter: false until the glyph should exist in layout. */
  mount: boolean;
};

export function enterFramesFor(fps: number): number {
  return Math.max(2, Math.round(CAPTION_ENTER_SEC * fps));
}

export function shouldSkipMotion(
  durationFrames: number,
  enterFrames: number,
): boolean {
  return durationFrames < enterFrames;
}

/**
 * Enter/exit motion for a timed target (word or group).
 * Exit mirrors enter near the end of `endFrame`.
 */
export function resolveEnterExitMotion(input: {
  animation: CaptionAnimation;
  frame: number;
  startFrame: number;
  endFrame: number;
  fps: number;
}): CaptionMotion {
  const { animation, frame, startFrame, endFrame, fps } = input;
  const enterFrames = enterFramesFor(fps);
  const duration = Math.max(1, endFrame - startFrame);
  const skip = shouldSkipMotion(duration, enterFrames);

  if (frame < startFrame) {
    return { opacity: 0, scale: 1, translateY: 0, mount: false };
  }
  if (frame >= endFrame) {
    return { opacity: 0, scale: 1, translateY: 0, mount: false };
  }

  if (animation === "none" || animation === "typewriter" || skip) {
    return { opacity: 1, scale: 1, translateY: 0, mount: true };
  }

  const local = frame - startFrame;
  const exitFrames = Math.min(
    enterFrames,
    Math.max(1, Math.floor(duration / 2)),
  );
  const exitStart = Math.max(enterFrames, duration - exitFrames);

  let enterT = 1;
  if (local < enterFrames) {
    enterT = interpolate(local, [0, enterFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  let exitT = 0;
  if (local >= exitStart) {
    exitT = interpolate(local, [exitStart, duration], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  const t = enterT * (1 - exitT);

  switch (animation) {
    case "fade":
      return { opacity: t, scale: 1, translateY: 0, mount: true };
    case "scale": {
      const enterScale =
        local < enterFrames
          ? interpolate(
              local,
              [0, enterFrames * 0.6, enterFrames],
              [0.4, 1.25, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              },
            )
          : 1;
      const exitScale =
        local >= exitStart
          ? interpolate(local, [exitStart, duration], [1, 0.85], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 1;
      return {
        opacity: local >= exitStart ? 1 - exitT : 1,
        scale: enterScale * exitScale,
        translateY: 0,
        mount: true,
      };
    }
    case "slide": {
      const enterY =
        local < enterFrames
          ? interpolate(local, [0, enterFrames], [-SLIDE_OFFSET_PX, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;
      const exitY =
        local >= exitStart
          ? interpolate(local, [exitStart, duration], [0, SLIDE_OFFSET_PX], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;
      return {
        opacity: t,
        scale: 1,
        translateY: enterY + exitY,
        mount: true,
      };
    }
    default:
      return { opacity: 1, scale: 1, translateY: 0, mount: true };
  }
}

export type WordState = "future" | "active" | "past";

export function wordStateAt(frame: number, word: CaptionWord): WordState {
  if (frame < word.startFrame) return "future";
  if (frame >= word.endFrame) return "past";
  return "active";
}

/** Blend progress 0–1 while leaving `from` toward `to` around a boundary. */
export function wordStateBlendT(
  frame: number,
  word: CaptionWord,
  fps: number,
  blendSec: number,
): { from: WordState; to: WordState; t: number } {
  const blendFrames = Math.max(1, Math.round(blendSec * fps));
  const state = wordStateAt(frame, word);

  if (state === "active") {
    const since = frame - word.startFrame;
    if (since < blendFrames) {
      return {
        from: "future",
        to: "active",
        t: interpolate(since, [0, blendFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      };
    }
    return { from: "active", to: "active", t: 1 };
  }

  if (state === "past") {
    const since = frame - word.endFrame;
    if (since < blendFrames) {
      return {
        from: "active",
        to: "past",
        t: interpolate(since, [0, blendFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      };
    }
    return { from: "past", to: "past", t: 1 };
  }

  return { from: "future", to: "future", t: 1 };
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
 * Static typewriter: word chunks with global char stagger.
 * Spaces between words are implicit (flex gap); timing includes a beat per space.
 * Letter reveal inside each word uses {@link wordTypewriterCharStart}.
 * Uses {@link TYPEWRITER_CHAR_DELAY_SEC} when it fits; otherwise compresses to `endFrame`.
 */
export function typewriterWordTimings(
  text: string,
  fps: number,
  endFrame: number,
): CaptionWord[] {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length === 0) return [];

  const tokens = flat.split(" ").filter((t) => t.length > 0);
  const totalChars = flat.length;
  const groupEnd = Math.max(1, endFrame);

  const idealDelay = Math.max(1, Math.round(TYPEWRITER_CHAR_DELAY_SEC * fps));
  const idealTotal = totalChars * idealDelay;
  const fitsIdeal = idealTotal <= groupEnd;

  const frameAt = (charIndex: number): number => {
    if (fitsIdeal) return charIndex * idealDelay;
    return Math.min(
      groupEnd - 1,
      Math.floor((charIndex / totalChars) * groupEnd),
    );
  };

  let charOffset = 0;

  return tokens.map((wordText, i) => {
    const startFrame = frameAt(charOffset);
    const wordEndFrame = frameAt(charOffset + wordText.length);
    if (i < tokens.length - 1) {
      charOffset += wordText.length + 1;
    } else {
      charOffset += wordText.length;
    }
    return {
      text: wordText,
      startFrame,
      endFrame: wordEndFrame,
    };
  });
}

/**
 * Word-scope typewriter: reveal letters across the word's own duration.
 * Returns start frames for each character relative to composition.
 */
export function wordTypewriterCharStart(
  word: CaptionWord,
  charIndex: number,
  charCount: number,
): number {
  if (charCount <= 1) return word.startFrame;
  const span = Math.max(1, word.endFrame - word.startFrame);
  const t = charIndex / charCount;
  return word.startFrame + Math.floor(t * span);
}
