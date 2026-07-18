import { isSelected } from "../../../lib/selection";
import { clampRangeEdge } from "../../../lib/range";
import { maybeSnapTimelineSec } from "../../../lib/snap";
import { useSelection } from "../../../selection-store";
import { useEditor, useFlatCaptions } from "../../../store";
import type { SectionLayoutItem } from "../hooks/useTimelineLayout";
import { Handle, useTrackDrag } from "../shared";
import { VoiceBand } from "../tracks/VoiceBand";

type Props = {
  item: SectionLayoutItem;
};

export function SectionCell({ item }: Props) {
  const setSectionEdge = useEditor((s) => s.setSectionEdge);
  const selection = useSelection((s) => s.selection);
  const selectKeepRegion = useSelection((s) => s.selectKeepRegion);
  const captions = useFlatCaptions();
  const { startDrag } = useTrackDrag();

  const selected = isSelected(selection, "keepRegion", item.keepRegionIndex);
  const duration = item.end - item.start;

  return (
    <div
      className={`absolute top-1 bottom-1 cursor-pointer overflow-hidden rounded text-[10px] text-[#1a1508] select-none ${
        selected
          ? "z-[2] bg-yellow-400 outline outline-2 outline-white"
          : "bg-yellow-500/80 hover:bg-yellow-500"
      }`}
      style={{ left: item.x, width: item.width }}
      title={`Keep ${duration.toFixed(2)}s — click to select, press Delete to remove`}
      onClick={(e) => {
        e.stopPropagation();
        selectKeepRegion(selected ? null : item.keepRegionIndex);
      }}
    >
      <VoiceBand start={item.start} end={item.end} captions={captions} />
      <Handle
        side="left"
        className="z-20"
        onMouseDown={(e) => {
          const origin = item.start;
          const fixedEnd = item.end;
          startDrag(e, (dxSec, _dxPx, shiftKey) => {
            const raw = Math.max(0, origin + dxSec);
            const snapped = maybeSnapTimelineSec(
              raw,
              captions,
              shiftKey,
              "start",
            );
            const { start } = clampRangeEdge("start", snapped, {
              start: origin,
              end: fixedEnd,
            });
            setSectionEdge(item.keepRegionIndex, "start", start, true);
          });
        }}
      />
      <Handle
        side="right"
        className="z-20"
        onMouseDown={(e) => {
          const origin = item.end;
          const fixedStart = item.start;
          startDrag(e, (dxSec, _dxPx, shiftKey) => {
            const raw = origin + dxSec;
            const snapped = maybeSnapTimelineSec(
              raw,
              captions,
              shiftKey,
              "end",
            );
            const { end } = clampRangeEdge("end", snapped, {
              start: fixedStart,
              end: origin,
            });
            setSectionEdge(item.keepRegionIndex, "end", end, true);
          });
        }}
      />
    </div>
  );
}
