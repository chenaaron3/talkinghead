import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { CaptionGroupView } from "@src/components/captions/CaptionGroupView";
import type { CaptionStyle } from "@src/lib/captions/style";
import { CAPTION_FADE_DURATION_SEC } from "@src/lib/episode/constants";
import type { CaptionGroup, CaptionWord } from "@src/lib/types";

/** Fixed sample — CSS textTransform handles case. */
const PREVIEW_TEXTS = ["This", "is", "a", "caption"] as const;

const PREVIEW_FPS = 30;
const WORD_STAGGER_FRAMES = 7;
const HOLD_FRAMES = 18;

function buildPreviewWords(): CaptionWord[] {
  return PREVIEW_TEXTS.map((text, i) => {
    const startFrame = i * WORD_STAGGER_FRAMES;
    return {
      text,
      startFrame,
      endFrame: startFrame + WORD_STAGGER_FRAMES,
    };
  });
}

function cycleLength(wordCount: number): number {
  return Math.max(1, (wordCount - 1) * WORD_STAGGER_FRAMES + HOLD_FRAMES);
}

function usePreviewFrame(playing: boolean, wordCount: number): number {
  const [frame, setFrame] = useState(0);
  const len = cycleLength(wordCount);

  useEffect(() => {
    if (!playing) {
      setFrame(0);
      return;
    }
    setFrame(0);
    let current = 0;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      if (now - last >= 1000 / PREVIEW_FPS) {
        last = now;
        current = (current + 1) % len;
        setFrame(current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, wordCount, len]);

  // Idle: past the last word so the full phrase is shown settled.
  return playing ? frame : len;
}

/** Template picker sample — CaptionGroupView + hardcoded words. */
export function CaptionTemplatePreview({
  style,
  playing = false,
  className,
}: {
  style: CaptionStyle;
  /** Loop the template’s entrance animation (set while hovering a chip). */
  playing?: boolean;
  className?: string;
}) {
  const words = useMemo(() => buildPreviewWords(), []);
  const frame = usePreviewFrame(playing, words.length);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const fadeFrames = Math.max(
    1,
    Math.round(CAPTION_FADE_DURATION_SEC * PREVIEW_FPS),
  );
  const groupEndFrame = cycleLength(words.length);

  const group: CaptionGroup = useMemo(
    () => ({
      words,
      startFrame: 0,
      endFrame: groupEndFrame,
      style,
    }),
    [words, groupEndFrame, style],
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const measure = () => {
      const pad = 12;
      const cw = Math.max(1, container.clientWidth - pad * 2);
      const ch = Math.max(1, container.clientHeight - pad * 2);
      const prev = content.style.transform;
      content.style.transform = "scale(1)";
      const bw = Math.max(1, content.offsetWidth);
      const bh = Math.max(1, content.offsetHeight);
      content.style.transform = prev;
      setScale(Math.min(1, cw / bw, ch / bh));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [
    style.fontFamily,
    style.fontSize,
    style.backdrop,
    style.stack,
    style.stroke?.width,
    style.stroke?.color,
    style.textTransform,
    style.shadow,
    style.color,
  ]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: 132,
        overflow: "hidden",
        padding: 12,
        background: "linear-gradient(180deg, #2a2f3a 0%, #1a1d26 100%)",
      }}
    >
      <div
        ref={contentRef}
        style={{
          width: "100%",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <CaptionGroupView
          group={group}
          frame={frame}
          fps={PREVIEW_FPS}
          fadeFrames={fadeFrames}
          embed
        />
      </div>
    </div>
  );
}
