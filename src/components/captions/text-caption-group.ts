import type { CaptionStyle } from "../../lib/captions/style";
import type { CaptionGroup, CaptionWord } from "../../lib/types";

import {
  typewriterCharWords,
  typewriterTypeFrames,
} from "./caption-animation";

/**
 * Build a caption group for on-screen text VFX via CaptionGroupView.
 * - typewriter → per-character words
 * - pop (stamp) → all words visible; enter scale stays in the text wrapper
 * - otherwise → spaced words, all visible from frame 0
 */
export function buildTextCaptionGroup(
  text: string,
  style: CaptionStyle,
  fps: number,
  durationFrames: number,
): CaptionGroup {
  const endFrame = Math.max(1, durationFrames);
  let words: CaptionWord[];

  if (style.animation === "typewriter") {
    words = typewriterCharWords(text, typewriterTypeFrames(fps, endFrame));
  } else {
    const parts = text
      .split(/(\n)/)
      .flatMap((part) =>
        part === "\n"
          ? ["\n"]
          : part.split(/\s+/).filter((t) => t.length > 0),
      );
    words = parts.map((word) => ({
      text: word,
      startFrame: 0,
      endFrame,
    }));
  }

  // Stamp enter is group-level in TikTokText; avoid per-word pop here.
  const groupStyle: CaptionStyle =
    style.animation === "pop" ? { ...style, animation: "none" } : style;

  return {
    words,
    startFrame: 0,
    endFrame,
    style: groupStyle,
  };
}
