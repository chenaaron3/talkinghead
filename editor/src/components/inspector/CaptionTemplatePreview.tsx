import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { DynamicGroupView } from "@src/components/captions/DynamicGroupView";
import { StaticGroupView } from "@src/components/captions/StaticGroupView";
import type { CaptionGroupStyle } from "@src/lib/captions/style";
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
  SAFE_AREA,
} from "@src/lib/episode/constants";
import type { CaptionGroup, CaptionWord } from "@src/lib/types";

/** Fixed sample phrases — CSS textTransform handles case. */
const PREVIEW_PHRASES = [
  ["This", "is", "a", "caption"],
  ["Watch", "what", "happens", "next"],
  ["Keep", "going"],
] as const;

const PREVIEW_FPS = 30;
const WORD_STAGGER_FRAMES = 7;
const HOLD_FRAMES = 18;
const GAP_FRAMES = 8;

const SAFE_TOP = 0.12;
const SAFE_BOTTOM = 0.22;

function groupDuration(wordCount: number): number {
  return Math.max(1, (wordCount - 1) * WORD_STAGGER_FRAMES + HOLD_FRAMES);
}

function buildPreviewGroups(style: CaptionGroupStyle): CaptionGroup[] {
  let cursor = 0;
  return PREVIEW_PHRASES.map((texts) => {
    const startFrame = cursor;
    const words: CaptionWord[] = texts.map((text, i) => {
      const wordStart = startFrame + i * WORD_STAGGER_FRAMES;
      return {
        text,
        startFrame: wordStart,
        endFrame: wordStart + WORD_STAGGER_FRAMES,
      };
    });
    const endFrame = startFrame + groupDuration(texts.length);
    cursor = endFrame + GAP_FRAMES;
    return { words, startFrame, endFrame, style };
  });
}

function usePreviewFrame(
  playing: boolean,
  cycleLen: number,
  idleFrame: number,
): number {
  const [frame, setFrame] = useState(idleFrame);

  useEffect(() => {
    if (!playing) {
      setFrame(idleFrame);
      return;
    }
    setFrame(0);
    let current = 0;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      if (now - last >= 1000 / PREVIEW_FPS) {
        last = now;
        current = (current + 1) % cycleLen;
        setFrame(current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, cycleLen, idleFrame]);

  return frame;
}

function captionFocusY(styleY: number): number {
  return SAFE_TOP + styleY * (1 - SAFE_TOP - SAFE_BOTTOM);
}

/**
 * Template picker preview — captions/quotes via {@link DynamicGroupView},
 * text VFX via {@link StaticGroupView}.
 */
export function CaptionTemplatePreview({
  style,
  playing = false,
  className,
  variant = "dynamic",
}: {
  style: CaptionGroupStyle;
  playing?: boolean;
  className?: string;
  variant?: "dynamic" | "static";
}) {
  const groups = useMemo(() => buildPreviewGroups(style), [style]);
  const cycleLen = useMemo(() => {
    const last = groups[groups.length - 1];
    return last ? last.endFrame + GAP_FRAMES : 1;
  }, [groups]);
  const idleFrame = Math.max(0, (groups[0]?.endFrame ?? 1) - 1);
  const frame = usePreviewFrame(playing, cycleLen, idleFrame);
  const displayFrame = playing ? frame : idleFrame;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offsetY, setOffsetY] = useState(0);

  const focusY = captionFocusY(style.y);

  const active = groups.find(
    (group) =>
      displayFrame >= group.startFrame && displayFrame < group.endFrame,
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const cw = Math.max(1, container.clientWidth);
      const ch = Math.max(1, container.clientHeight);
      const nextScale = cw / COMPOSITION_WIDTH;
      setScale(nextScale);
      setOffsetY(ch / 2 - focusY * COMPOSITION_HEIGHT * nextScale);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [focusY]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: 128,
        overflow: "hidden",
        background: "linear-gradient(180deg, #2a2f3a 0%, #1a1d26 100%)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: offsetY,
          width: COMPOSITION_WIDTH,
          height: COMPOSITION_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: SAFE_AREA.top,
            bottom: SAFE_AREA.bottom,
            left: SAFE_AREA.left,
            right: SAFE_AREA.right,
          }}
        >
          {active ? (
            variant === "static" ? (
              <StaticGroupView
                group={active}
                frame={displayFrame}
                fps={PREVIEW_FPS}
              />
            ) : (
              <DynamicGroupView
                group={active}
                frame={displayFrame}
                fps={PREVIEW_FPS}
              />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
