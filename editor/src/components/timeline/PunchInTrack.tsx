import { clampRangeEdge } from "../../lib/range";
import { maybeSnapTimelineSec } from "../../lib/snap";
import { useEditor } from "../../store";
import { Handle, TrackLabel, useTrackDrag } from "./shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
  onNeedleX: (x: number | null) => void;
};

export function PunchInTrack({ width, sourceX, onNeedleX }: Props) {
  const punchIns = useEditor((s) => s.config?.punchInSegments ?? []);
  const selectedPunchInIndex = useEditor((s) => s.selectedPunchInIndex);
  const selectPunchIn = useEditor((s) => s.selectPunchIn);
  const captions = useEditor((s) => s.transcript?.captions ?? []);
  const updatePunchInRange = useEditor((s) => s.updatePunchInRange);
  const { startDrag, scrubTo } = useTrackDrag(onNeedleX);

  return (
    <TrackLabel label="Zoom" width={width}>
      {punchIns.map((p, i) => {
        const left = sourceX(p.start);
        const right = sourceX(p.end);
        const selected = selectedPunchInIndex === i;
        return (
          <div
            key={`punch-${i}`}
            className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded bg-purple-500/50 px-1 text-[10px] text-white select-none ${
              selected ? "z-[2] outline outline-2 outline-white" : ""
            }`}
            style={{ left, width: Math.max(8, right - left) }}
            title={`Punch-in ${p.start.toFixed(2)}–${p.end.toFixed(2)}s`}
            onClick={(e) => {
              e.stopPropagation();
              selectPunchIn(i);
            }}
          >
            <Handle
              side="left"
              onMouseDown={(e) => {
                const origin = p.start;
                const fixedEnd = p.end;
                const originX = left;
                startDrag(e, (dxSec, dxPx, shiftKey) => {
                  const raw = Math.max(0, origin + dxSec);
                  const snapped = maybeSnapTimelineSec(raw, captions, shiftKey);
                  const { start, end } = clampRangeEdge("start", snapped, {
                    start: origin,
                    end: fixedEnd,
                  });
                  updatePunchInRange(i, start, end, true);
                  scrubTo(start, originX + dxPx);
                });
              }}
            />
            {p.scale.toFixed(2)}x
            <Handle
              side="right"
              onMouseDown={(e) => {
                const origin = p.end;
                const fixedStart = p.start;
                const originX = right;
                startDrag(e, (dxSec, dxPx, shiftKey) => {
                  const raw = origin + dxSec;
                  const snapped = maybeSnapTimelineSec(raw, captions, shiftKey);
                  const { start, end } = clampRangeEdge("end", snapped, {
                    start: fixedStart,
                    end: origin,
                  });
                  updatePunchInRange(i, start, end, true);
                  scrubTo(end, originX + dxPx);
                });
              }}
            />
          </div>
        );
      })}
    </TrackLabel>
  );
}
