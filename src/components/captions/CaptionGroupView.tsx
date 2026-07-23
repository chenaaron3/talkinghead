import React from 'react';

import { DEFAULT_CAPTION_STYLE } from '../../lib/captions/style';
import { lastVisibleWordIndex, typewriterCursorOn } from './caption-animation';
import { captionStyleToCss } from './caption-style-css';
import { CaptionWordSpan } from './CaptionWordSpan';

import type { CaptionGroup, CaptionWord } from "../../lib/types";

/** Split a group into two rows: first half / second half (ceil on top). */
export function splitCaptionLines<T>(words: T[]): { top: T[]; bottom: T[] } {
  if (words.length === 0) return { top: [], bottom: [] };
  const mid = Math.ceil(words.length / 2);
  return {
    top: words.slice(0, mid),
    bottom: words.slice(mid),
  };
}

/** Renders one active caption group at its styled Y within the safe area. */
export const CaptionGroupView: React.FC<{
  group: CaptionGroup;
  frame: number;
  fps: number;
  fadeFrames: number;
  /**
   * Skip absolute safe-area placement — for inspector template preview
   * where the parent centers/scales the group.
   */
  embed?: boolean;
}> = ({ group, frame, fps, fadeFrames, embed = false }) => {
  const style = group.style ?? DEFAULT_CAPTION_STYLE;
  const animation = style.animation;
  const karaoke = animation === "karaoke";
  const stack = style.stack ?? false;
  const backdrop = style.backdrop ?? "none";
  // Karaoke needs the truly spoken index (not "all visible").
  const lastVisibleIndex = lastVisibleWordIndex(
    group.words,
    frame,
    animation === "none",
  );
  const cursorOn = typewriterCursorOn(
    animation,
    lastVisibleIndex,
    frame,
    group.endFrame,
  );

  const baseText = captionStyleToCss(style);
  const gap = backdrop === "scrap" || backdrop === "pill" ? "0.45em 0.55em" : "0.35em";

  const renderWord = (word: CaptionWord, index: number) => {
    const spoken = karaoke
      ? frame >= word.startFrame
      : animation === "none" || frame >= word.startFrame;
    return (
      <CaptionWordSpan
        key={`${word.startFrame}-${word.text}-${index}`}
        word={word}
        index={index}
        frame={frame}
        fps={fps}
        groupEndFrame={group.endFrame}
        fadeFrames={fadeFrames}
        animation={animation}
        spoken={spoken}
        active={karaoke && index === lastVisibleIndex}
        showCursor={
          animation === "typewriter" &&
          index === lastVisibleIndex &&
          cursorOn
        }
        cursorColor={style.color}
        backdrop={backdrop}
      />
    );
  };

  const groupChrome: React.CSSProperties =
    backdrop === "box"
      ? {
        backgroundColor: "rgba(0, 0, 0, 0.82)",
        padding: "0.35em 0.55em",
        borderRadius: 8,
      }
      : {};

  let body: React.ReactNode;
  if (stack) {
    const { top, bottom } = splitCaptionLines(
      group.words.map((word, index) => ({ word, index })),
    );
    body = (
      <div
        style={{
          ...baseText,
          ...groupChrome,
          display: "flex",
          flexDirection: "column",
          gap: "0.25em",
          width: "100%",
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "flex-start",
            gap,
            width: "100%",
          }}
        >
          {top.map(({ word, index }) => renderWord(word, index))}
        </div>
        {bottom.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              gap,
              width: "100%",
            }}
          >
            {bottom.map(({ word, index }) => renderWord(word, index))}
          </div>
        ) : null}
      </div>
    );
  } else {
    body = (
      <p
        style={{
          ...baseText,
          ...groupChrome,
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap,
          width: backdrop === "box" ? "auto" : "100%",
          maxWidth: "100%",
        }}
      >
        {group.words.map((word, index) => renderWord(word, index))}
      </p>
    );
  }

  if (embed) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
        }}
      >
        {body}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        top: `${style.y * 100}%`,
        left: 0,
        right: 0,
        transform: "translateY(-50%)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      {body}
    </div>
  );
};
