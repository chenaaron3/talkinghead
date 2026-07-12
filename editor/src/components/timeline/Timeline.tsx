import { useRef } from "react";
import { useEditor } from "../../store";
import { BRollTrack } from "./BRollTrack";
import { useTimelineNeedle } from "./shared";
import { useTimelineLayout } from "./useTimelineLayout";
import { VideoTrack } from "./VideoTrack";

export function Timeline() {
  const props = useEditor((s) => s.props);
  const frame = useEditor((s) => s.frame);
  const pxPerFrame = useEditor((s) => s.pxPerFrame);
  const setPxPerFrame = useEditor((s) => s.setPxPerFrame);
  const selectGap = useEditor((s) => s.selectGap);
  const seek = useEditor((s) => s.seek);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { dragNeedleX, setDragNeedleX } = useTimelineNeedle();
  const { items, totalWidth, outputX } = useTimelineLayout();

  if (!props) return null;

  const trackWidth = totalWidth - 40;

  return (
    <div className="flex min-h-0 min-w-0 w-full max-w-[100vw] flex-col overflow-hidden bg-panel">
      <div
        className="relative min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        ref={scrollRef}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
            setPxPerFrame(Math.min(4, Math.max(0.08, pxPerFrame * factor)));
          }
        }}
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
            for (const item of items) {
              if (item.kind !== "section") continue;
              if (x >= item.x && x <= item.x + item.width) {
                seek(Math.round(item.outputStart + (x - item.x) / pxPerFrame));
                return;
              }
            }
          }}
        >
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-400"
            style={{ left: 72 + (dragNeedleX ?? outputX(frame)) }}
          />

          <VideoTrack
            width={trackWidth}
            items={items}
            onNeedleX={setDragNeedleX}
          />
          <BRollTrack
            width={trackWidth}
            outputX={outputX}
            onNeedleX={setDragNeedleX}
          />
        </div>
      </div>
    </div>
  );
}
