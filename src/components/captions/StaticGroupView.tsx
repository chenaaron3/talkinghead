import React, { type CSSProperties } from "react";

import { DEFAULT_CAPTION_STYLE } from "../../lib/captions/style";
import type { CaptionGroup } from "../../lib/types";

import { resolveEnterExitMotion } from "./caption-animation";
import { CaptionGroupLayout } from "./CaptionGroupLayout";
import { CaptionWordSpan } from "./CaptionWordSpan";

/**
 * Group-level enter/exit; words paint active style (text VFX).
 * Typewriter staggers via word timings + letter reveal in {@link CaptionWordSpan}.
 */
export const StaticGroupView: React.FC<{
  group: CaptionGroup;
  frame: number;
  fps: number;
}> = ({ group, frame, fps }) => {
  const style = group.style ?? DEFAULT_CAPTION_STYLE;
  const animation = style.animation;

  const groupMotion = resolveEnterExitMotion({
    animation: animation === "typewriter" ? "none" : animation,
    frame,
    startFrame: group.startFrame,
    endFrame: group.endFrame,
    fps,
  });

  const shellStyle: CSSProperties = {
    opacity: groupMotion.opacity,
    transform: [
      "translateY(-50%)",
      groupMotion.scale !== 1 ? `scale(${groupMotion.scale})` : "",
      groupMotion.translateY !== 0
        ? `translateY(${groupMotion.translateY}px)`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
  };

  return (
    <CaptionGroupLayout group={group} shellStyle={shellStyle}>
      {group.words.map((word, index) => (
        <CaptionWordSpan
          key={`${word.startFrame}-${word.text}-${index}`}
          word={word}
          index={index}
          words={group.words}
          frame={frame}
          fps={fps}
          groupEndFrame={group.endFrame}
          groupStyle={style}
          animateWord={false}
          cycleWordStates={false}
        />
      ))}
    </CaptionGroupLayout>
  );
};
