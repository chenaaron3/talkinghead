import React from "react";

import { DEFAULT_CAPTION_STYLE } from "../../lib/captions/style";
import type { CaptionGroup, CaptionWord } from "../../lib/types";

import { lastVisibleWordIndex, typewriterCursorOn } from "./caption-animation";
import { captionStyleToCss } from "./caption-style-css";
import { CaptionWordSpan } from "./CaptionWordSpan";

/** Split a group into two rows: first half / second half (ceil on top). */
export function splitCaptionLines<T>(words: T[]): { top: T[]; bottom: T[] } {
  if (words.length === 0) return { top: [], bottom: [] };
  const mid = Math.ceil(words.length / 2);
  return {
    top: words.slice(0, mid),
    bottom: words.slice(mid),
  };
}

function boxChrome(style: NonNullable<CaptionGroup["style"]>): React.CSSProperties {
  const fill = style.backdropColor?.trim() || "rgba(0, 0, 0, 0.82)";
  const board = Boolean(style.backdropColor?.trim());
  if (!board) {
    return {
      backgroundColor: fill,
      padding: "0.35em 0.55em",
      borderRadius: 8,
    };
  }
  const yellow = fill.toLowerCase() === "#ffe600";
  return {
    backgroundColor: fill,
    borderRadius: yellow ? 24 : 20,
    padding: yellow ? "28px 32px" : "22px 28px",
    boxShadow: "0 6px 0 rgba(0, 0, 0, 0.35)",
  };
}

type CharTypewriterRun =
  | { kind: "word"; items: { word: CaptionWord; index: number }[] }
  | { kind: "break"; word: CaptionWord; index: number };

/**
 * Bundle glyph words into nowrap runs so flex wrap only breaks on
 * spaces / newlines — never mid-word.
 */
function groupTypewriterChars(words: CaptionWord[]): CharTypewriterRun[] {
  const runs: CharTypewriterRun[] = [];
  let current: { word: CaptionWord; index: number }[] = [];

  const flush = () => {
    if (current.length === 0) return;
    runs.push({ kind: "word", items: current });
    current = [];
  };

  words.forEach((word, index) => {
    if (word.text === "\n" || /^\s+$/.test(word.text)) {
      flush();
      runs.push({ kind: "break", word, index });
      return;
    }
    current.push({ word, index });
  });
  flush();
  return runs;
}

/** Renders one active caption group at its styled Y within the safe area. */
export const CaptionGroupView: React.FC<{
  group: CaptionGroup;
  frame: number;
  fps: number;
  fadeFrames: number;
}> = ({ group, frame, fps, fadeFrames }) => {
  const style = group.style ?? DEFAULT_CAPTION_STYLE;
  const animation = style.animation;
  const karaoke = animation === "karaoke";
  const stack = style.stack ?? false;
  const backdrop = style.backdrop ?? "none";
  const textAlign = style.textAlign ?? "center";
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
  // Char-level typewriter (title) uses single-glyph words — no flex gap.
  const charTypewriter =
    animation === "typewriter" &&
    group.words.every((w) => w.text.length <= 1);
  const gap = charTypewriter
    ? 0
    : backdrop === "scrap" || backdrop === "pill"
      ? "0.45em 0.55em"
      : "0.35em";

  const renderWord = (word: CaptionWord, index: number) => {
    if (word.text === "\n") {
      return (
        <span
          key={`br-${index}`}
          style={{ flexBasis: "100%", width: "100%", height: 0 }}
        />
      );
    }

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
    backdrop === "box" ? boxChrome(style) : {};

  const rowJustify =
    textAlign === "left" ? "flex-start" : "center";

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
    const children = charTypewriter
      ? groupTypewriterChars(group.words).map((run, runIndex) => {
          if (run.kind === "break") {
            return renderWord(run.word, run.index);
          }
          return (
            <span
              key={`tw-word-${runIndex}-${run.items[0]!.index}`}
              style={{
                display: "inline-flex",
                flexWrap: "nowrap",
                whiteSpace: "nowrap",
                alignItems: "center",
              }}
            >
              {run.items.map(({ word, index }) => renderWord(word, index))}
            </span>
          );
        })
      : group.words.map((word, index) => renderWord(word, index));

    body = (
      <p
        style={{
          ...baseText,
          ...groupChrome,
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: rowJustify,
          gap,
          width: backdrop === "box" ? "auto" : "100%",
          maxWidth: "100%",
        }}
      >
        {children}
      </p>
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
        justifyContent: rowJustify,
      }}
    >
      {body}
    </div>
  );
};
