import { useEffect, useRef } from 'react';

import { useEditor } from '../../store';
import { BRollTrack } from './BRollTrack';
import { CaptionTrack } from './CaptionTrack';
import { ListicleTrack } from './ListicleTrack';
import { PunchInTrack } from './PunchInTrack';
import { useTimelineNeedle } from './shared';
import { useTimelineLayout } from './useTimelineLayout';
import { VideoTrack } from './VideoTrack';

export function Timeline() {
  const duration = useEditor((s) => s.transcript?.duration ?? 0);
  const sourceSec = useEditor((s) => s.sourceSec);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const setPxPerSec = useEditor((s) => s.setPxPerSec);
  const selectGap = useEditor((s) => s.selectGap);
  const seekSource = useEditor((s) => s.seekSource);

  const scrollRef = useRef<HTMLDivElement>(null);
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
      setPxPerSec(Math.min(200, Math.max(8, current * factor)));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setPxPerSec]);

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
            const sec = x / pxPerSec;
            if (sec >= 0 && sec <= duration) {
              seekSource(sec);
            }
          }}
        >
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-400"
            style={{ left: 72 + (dragNeedleX ?? sourceX(sourceSec)) }}
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
