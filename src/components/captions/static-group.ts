import type { CaptionGroupStyle } from "../../lib/captions/style";
import type { CaptionGroup, CaptionWord } from "../../lib/types";

import { typewriterWordTimings } from "./caption-animation";

/**
 * Build a caption group for {@link StaticGroupView}.
 * - typewriter → word chunks with global char stagger (letters reveal in span)
 * - otherwise → spaced words, all visible from frame 0 (group enter animates wrapper)
 */
export function buildStaticGroup(
  text: string,
  style: CaptionGroupStyle,
  fps: number,
  durationFrames: number,
): CaptionGroup {
  const endFrame = Math.max(1, durationFrames);
  const flat = text.replace(/\s+/g, " ").trim();
  let words: CaptionWord[];

  if (style.animation === "typewriter") {
    words = typewriterWordTimings(flat, fps, endFrame);
  } else {
    words = flat
      .split(" ")
      .filter((t) => t.length > 0)
      .map((word) => ({
        text: word,
        startFrame: 0,
        endFrame,
      }));
  }

  return {
    words,
    startFrame: 0,
    endFrame,
    style,
  };
}
