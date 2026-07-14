import { maybeSnapTimelineSec } from "../../lib/snap";
import { useEditor, useFlatCaptions } from "../../store";
import { Handle, useTrackDrag } from "./shared";
import type { SectionLayoutItem } from "./useTimelineLayout";
import { VoiceBand } from "./VoiceBand";

type Props = {
  item: SectionLayoutItem;
  onNeedleX: (x: number | null) => void;
};

export function SectionCell({ item, onNeedleX }: Props) {
  const adjustSection = useEditor((s) => s.adjustSection);
  const captions = useFlatCaptions();
  const { startDrag, scrubTo } = useTrackDrag(onNeedleX);

  return (
    <div
      className="absolute top-1 bottom-1 overflow-hidden rounded bg-yellow-500/80 text-[10px] text-[#1a1508] select-none"
      style={{ left: item.x, width: item.width }}
      title={`Keep ${item.start.toFixed(2)}–${item.end.toFixed(2)}s`}
    >
      <VoiceBand
        start={item.start}
        end={item.end}
        captions={captions}
        pixelWidth={item.width}
      />
      <Handle
        side="left"
        className="z-20"
        onMouseDown={(e) => {
          const originEdge = item.start;
          let lastTarget = originEdge;
          const originX = item.x;
          startDrag(e, (dxSec, dxPx, shiftKey) => {
            const target = maybeSnapTimelineSec(
              originEdge + dxSec,
              captions,
              shiftKey,
            );
            const step = target - lastTarget;
            lastTarget = target;
            if (step !== 0) {
              adjustSection(item.keepRegionIndex, "start", step, true);
            }
            scrubTo(target, originX + dxPx);
          });
        }}
      />
      <Handle
        side="right"
        className="z-20"
        onMouseDown={(e) => {
          const originEdge = item.end;
          let lastTarget = originEdge;
          const originX = item.x + item.width;
          startDrag(e, (dxSec, dxPx, shiftKey) => {
            const target = maybeSnapTimelineSec(
              originEdge + dxSec,
              captions,
              shiftKey,
            );
            const step = target - lastTarget;
            lastTarget = target;
            if (step !== 0) {
              adjustSection(item.keepRegionIndex, "end", step, true);
            }
            scrubTo(target, originX + dxPx);
          });
        }}
      />
    </div>
  );
}
