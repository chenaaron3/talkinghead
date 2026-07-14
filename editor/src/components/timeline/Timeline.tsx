import { useEffect, useLayoutEffect, useRef } from 'react';

import { isTimelineScrubbing, useEditor } from '../../store';
import { BRollTrack } from './BRollTrack';
import { CaptionTrack } from './CaptionTrack';
import { ListicleTrack } from './ListicleTrack';
import { PunchInTrack } from './PunchInTrack';
import { useTimelineNeedle } from './shared';
import { useTimelineLayout } from './useTimelineLayout';
import { VideoTrack } from './VideoTrack';

const LABEL_OFFSET = 72;

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
  const sourceSec = useEditor((s) => s.sourceSec);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const setPxPerSec = useEditor((s) => s.setPxPerSec);
  const selectGap = useEditor((s) => s.selectGap);
  const selectKeepRegion = useEditor((s) => s.selectKeepRegion);
  const seekSource = useEditor((s) => s.seekSource);

  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomAnchorViewportX = useRef<number | null>(null);
  const { dragNeedleX, setDragNeedleX } = useTimelineNeedle();
  const { items, totalWidth, sourceX } = useTimelineLayout();

  const trackWidth = totalWidth - 40;

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

      const sec = useEditor.getState().sourceSec;
      const playheadX = playheadContentX(sec, current);
      zoomAnchorViewportX.current = playheadX - el.scrollLeft;
      setPxPerSec(next);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setPxPerSec]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    const anchor = zoomAnchorViewportX.current;
    if (!el || anchor == null) return;
    zoomAnchorViewportX.current = null;

    const { sourceSec: sec, pxPerSec: scale } = useEditor.getState();
    el.scrollLeft = playheadContentX(sec, scale) - anchor;
  }, [pxPerSec]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || isTimelineScrubbing()) return;
    scrollPlayheadIntoView(el, playheadContentX(sourceSec, pxPerSec));
  }, [sourceSec, pxPerSec]);

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-[100vw] flex-col overflow-hidden bg-panel">
      <div
        className="relative min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden [touch-action:pan-x]"
        ref={scrollRef}
      >
        <div
          className="relative min-h-full py-2 pl-[72px]"
          style={{ width: totalWidth }}
          onClick={(e) => {
            const rect = (
              e.currentTarget as HTMLDivElement
            ).getBoundingClientRect();
            const x =
              e.clientX - rect.left - 72 + (scrollRef.current?.scrollLeft ?? 0);
            selectGap(null);
            selectKeepRegion(null);
            const sec = x / pxPerSec;
            if (sec >= 0 && sec <= duration) {
              seekSource(sec);
            }
          }}
        >
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-400"
            style={{ left: LABEL_OFFSET + (dragNeedleX ?? sourceX(sourceSec)) }}
          />

          <VideoTrack
            width={trackWidth}
            items={items}
            onNeedleX={setDragNeedleX}
          />
          <CaptionTrack width={trackWidth} sourceX={sourceX} />
          <BRollTrack
            width={trackWidth}
            sourceX={sourceX}
            onNeedleX={setDragNeedleX}
          />
          <PunchInTrack
            width={trackWidth}
            sourceX={sourceX}
            onNeedleX={setDragNeedleX}
          />
          <ListicleTrack
            width={trackWidth}
            sourceX={sourceX}
            onNeedleX={setDragNeedleX}
          />
        </div>
      </div>
    </div>
  );
}
