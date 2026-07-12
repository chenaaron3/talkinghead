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
  const { startDrag, scrubTo } = useTrackDrag(onNeedleX);

  return (
    <div
      className="absolute top-1 bottom-1 flex items-center overflow-hidden rounded bg-blue-500 px-1.5 text-[10px] text-white select-none"
      style={{ left: item.x, width: item.width }}
      title={`Section ${item.index + 1}`}
    >
      <Handle
        side="left"
        onMouseDown={(e) => {
          let last = 0;
          const originX = item.x;
          startDrag(e, (dx, dxPx) => {
            const step = dx - last;
            last = dx;
            adjustSection(item.index, "start", -step, true);
            scrubTo(item.outputStart, originX + dxPx);
          });
        }}
      />
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-1">
        {label}
      </span>
      <Handle
        side="right"
        onMouseDown={(e) => {
          let last = 0;
          const originEnd = item.outputEnd;
          const originX = item.x + item.width;
          startDrag(e, (dx, dxPx) => {
            const step = dx - last;
            last = dx;
            adjustSection(item.index, "end", step, true);
            scrubTo(
              Math.max(item.outputStart, originEnd + last - 1),
              originX + dxPx,
            );
          });
        }}
      />
    </div>
  );
}
