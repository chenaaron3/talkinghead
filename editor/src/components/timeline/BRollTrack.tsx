import { clampRangeEdge } from "../../lib/range";
import { maybeSnapTimelineSec } from "../../lib/snap";
import { useEditor } from "../../store";
import { Handle, TrackLabel, useTrackDrag } from "./shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
  onNeedleX: (x: number | null) => void;
};

export function BRollTrack({ width, sourceX, onNeedleX }: Props) {
  const bRolls = useEditor((s) => s.config?.bRolls ?? []);
  const captions = useEditor((s) => s.transcript?.captions ?? []);
  const selectedBRollId = useEditor((s) => s.selectedBRollId);
  const selectBRoll = useEditor((s) => s.selectBRoll);
  const updateBRollRange = useEditor((s) => s.updateBRollRange);
  const { startDrag, scrubTo } = useTrackDrag(onNeedleX);

  return (
    <TrackLabel label="B-roll" width={width}>
      {bRolls.map((clip) => {
        const left = sourceX(clip.start);
        const right = sourceX(clip.end);
        return (
          <div
            key={clip.id}
            className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded bg-broll px-1.5 text-[10px] text-[#1a1508] select-none ${
              selectedBRollId === clip.id
                ? "z-[2] outline outline-2 outline-white"
                : ""
            }`}
            style={{ left, width: Math.max(8, right - left) }}
            onClick={(e) => {
              e.stopPropagation();
              selectBRoll(clip.id);
            }}
          >
            <Handle
              side="left"
              onMouseDown={(e) => {
                const origin = clip.start;
                const fixedEnd = clip.end;
                const originX = left;
                startDrag(e, (dxSec, dxPx, shiftKey) => {
                  const raw = Math.max(0, origin + dxSec);
                  const snapped = maybeSnapTimelineSec(raw, captions, shiftKey);
                  const { start, end } = clampRangeEdge("start", snapped, {
                    start: origin,
                    end: fixedEnd,
                  });
                  updateBRollRange(clip.id, start, end, true);
                  scrubTo(start, originX + dxPx);
                });
              }}
            />
            {clip.src.split("/").pop()}
            <Handle
              side="right"
              onMouseDown={(e) => {
                const origin = clip.end;
                const fixedStart = clip.start;
                const originX = right;
                startDrag(e, (dxSec, dxPx, shiftKey) => {
                  const raw = origin + dxSec;
                  const snapped = maybeSnapTimelineSec(raw, captions, shiftKey);
                  const { start, end } = clampRangeEdge("end", snapped, {
                    start: fixedStart,
                    end: origin,
                  });
                  updateBRollRange(clip.id, start, end, true);
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
