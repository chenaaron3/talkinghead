import { useEditor } from "../../store";
import { Handle, useTrackDrag } from "./shared";
import type { SectionLayoutItem } from "./useTimelineLayout";

type Props = {
  item: SectionLayoutItem;
  label: string;
  onNeedleX: (x: number | null) => void;
};

export function SectionCell({ item, label, onNeedleX }: Props) {
  const adjustSection = useEditor((s) => s.adjustSection);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const seekSource = useEditor((s) => s.seekSource);
  const { startDrag, scrubTo } = useTrackDrag(onNeedleX);

  return (
    <div
      className="absolute top-1 bottom-1 flex items-center overflow-hidden rounded bg-yellow-500/80 px-1.5 text-[10px] text-[#1a1508] select-none"
      style={{ left: item.x, width: item.width }}
      title={`Keep ${item.start.toFixed(2)}–${item.end.toFixed(2)}s`}
    >
      <Handle
        side="left"
        onMouseDown={(e) => {
          let lastSec = 0;
          const originX = item.x;
          startDrag(e, (dx, dxPx) => {
            const deltaSec = dx / pxPerSec;
            const step = deltaSec - lastSec;
            lastSec = deltaSec;
            adjustSection(item.keepRegionIndex, "start", step, true);
            scrubTo(item.start + deltaSec, originX + dxPx);
          });
        }}
      />
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-1">
        {label}
      </span>
      <Handle
        side="right"
        onMouseDown={(e) => {
          let lastSec = 0;
          const originX = item.x + item.width;
          startDrag(e, (dx, dxPx) => {
            const deltaSec = dx / pxPerSec;
            const step = deltaSec - lastSec;
            lastSec = deltaSec;
            adjustSection(item.keepRegionIndex, "end", step, true);
            seekSource(item.end + deltaSec);
            scrubTo(item.end + deltaSec, originX + dxPx);
          });
        }}
      />
    </div>
  );
}
