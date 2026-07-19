import { useEffect, useLayoutEffect, useRef } from "react";

import { getPlayer } from "../../lib/player-bridge";
import { useSelection } from "../../selection-store";
import { isTimelineScrubbing, useEditor } from "../../store";
import { LABEL_OFFSET } from "./constants";
import { usePlayheadInteraction } from "./hooks/usePlayheadInteraction";
import { useTimelineLayout } from "./hooks/useTimelineLayout";
import { Playhead } from "./Playhead";
import { TimelineRuler } from "./TimelineRuler";
import { BRollTrack } from "./tracks/BRollTrack";
import { CaptionTrack } from "./tracks/CaptionTrack";
import { ListicleTrack } from "./tracks/ListicleTrack";
import { MusicTrack } from "./tracks/MusicTrack";
import { PunchInTrack } from "./tracks/PunchInTrack";
import { SfxTrack } from "./tracks/SfxTrack";
import { VideoTrack } from "./tracks/VideoTrack";

function playheadContentX(sourceSec: number, pxPerSec: number): number {
  return LABEL_OFFSET + sourceSec * pxPerSec;
}

function scrollPlayheadIntoView(
  el: HTMLDivElement,
  playheadX: number,
): void {
  const viewLeft = el.scrollLeft;
  const viewRight = viewLeft + el.clientWidth;
  if (playheadX >= viewLeft && playheadX <= viewRight) return;

  if (playheadX < viewLeft) {
    el.scrollLeft = playheadX;
  } else {
    el.scrollLeft = playheadX - el.clientWidth;
  }
}

export function Timeline() {
  const duration = useEditor((s) => s.transcript?.duration ?? 0);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const setPxPerSec = useEditor((s) => s.setPxPerSec);
  const selectGap = useSelection((s) => s.selectGap);
  const selectKeepRegion = useSelection((s) => s.selectKeepRegion);
  const seekSource = useEditor((s) => s.seekSource);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const zoomAnchorSec = useRef<number | null>(null);
  const zoomAnchorViewportX = useRef<number | null>(null);
  const { items, totalWidth, sourceX } = useTimelineLayout();

  const trackWidth = totalWidth - 40;

  const {
    hoverSec,
    scrubbing,
    onMouseMove,
    onMouseLeave,
    onClick,
    startScrub,
  } = usePlayheadInteraction({
    contentRef,
    duration,
    pxPerSec,
    seekSource,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      const current = useEditor.getState().pxPerSec;
      const next = Math.min(200, Math.max(8, current * factor));
      if (next === current) return;

      const { sourceSec, transcript } = useEditor.getState();
      const duration = transcript?.duration ?? 0;
      let anchorSec = sourceSec;

      const content = contentRef.current;
      if (content && duration > 0) {
        const rect = content.getBoundingClientRect();
        const x = e.clientX - rect.left - LABEL_OFFSET;
        const hoverSec = x / current;
        if (hoverSec >= 0 && hoverSec <= duration) {
          anchorSec = hoverSec;
        }
      }

      const anchorX = playheadContentX(anchorSec, current);
      zoomAnchorSec.current = anchorSec;
      zoomAnchorViewportX.current = anchorX - el.scrollLeft;
      setPxPerSec(next);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setPxPerSec]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const anchor = zoomAnchorViewportX.current;
    const sec = zoomAnchorSec.current;
    if (!el || anchor == null || sec == null) return;
    zoomAnchorViewportX.current = null;
    zoomAnchorSec.current = null;

    const { pxPerSec: scale } = useEditor.getState();
    el.scrollLeft = playheadContentX(sec, scale) - anchor;
  }, [pxPerSec]);

  useEffect(() => {
    return useEditor.subscribe((state, prev) => {
      if (state.sourceSec === prev.sourceSec) return;
      if (isTimelineScrubbing()) return;
      if (getPlayer()?.isPlaying()) return;

      const el = scrollRef.current;
      if (!el) return;
      scrollPlayheadIntoView(
        el,
        playheadContentX(state.sourceSec, state.pxPerSec),
      );
    });
  }, []);

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-[100vw] flex-col overflow-hidden bg-panel">
      <div
        className="relative min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-auto [touch-action:pan-x_pan-y]"
        ref={scrollRef}
      >
        <div
          className="relative min-h-full"
          ref={contentRef}
          style={{ width: totalWidth }}
          onMouseMove={(e) => onMouseMove(e.clientX)}
          onMouseLeave={onMouseLeave}
          onClickCapture={(e) => {
            // Seek even when track items stopPropagation (select/drag handlers).
            onClick(e.clientX);
          }}
          onClick={() => {
            selectGap(null);
            selectKeepRegion(null);
          }}
        >
          <Playhead
            hoverSec={hoverSec}
            pxPerSec={pxPerSec}
            scrubbing={scrubbing}
            onScrubStart={startScrub}
          />

          <TimelineRuler
            duration={duration}
            pxPerSec={pxPerSec}
            trackWidth={trackWidth}
            onScrubStart={startScrub}
          />

          <div className="py-2 pl-[72px]">
            <VideoTrack width={trackWidth} items={items} />
            <CaptionTrack width={trackWidth} sourceX={sourceX} />
            <BRollTrack width={trackWidth} sourceX={sourceX} />
            <SfxTrack width={trackWidth} sourceX={sourceX} />
            <PunchInTrack width={trackWidth} sourceX={sourceX} />
            <ListicleTrack width={trackWidth} sourceX={sourceX} />
            <MusicTrack width={trackWidth} sourceX={sourceX} />
          </div>
        </div>
      </div>
    </div>
  );
}
