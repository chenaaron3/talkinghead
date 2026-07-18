import { EMPTY_BROLLS, EMPTY_CAPTIONS } from "../../lib/empty";
import { isSelected } from "../../lib/selection";
import { clampRangeEdge } from "../../lib/range";
import { maybeSnapTimelineSec } from "../../lib/snap";
import { useSelection } from "../../selection-store";
import { useEditor } from "../../store";
import { Handle, TrackLabel, useTrackDrag } from "./shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
};

export function BRollTrack({ width, sourceX }: Props) {
  const bRolls = useEditor((s) => s.config?.bRolls ?? EMPTY_BROLLS);
  const captions = useEditor((s) => s.transcript?.captions ?? EMPTY_CAPTIONS);
  const selection = useSelection((s) => s.selection);
  const selectBRoll = useSelection((s) => s.selectBRoll);
  const updateBRollRange = useEditor((s) => s.updateBRollRange);
  const { startDrag } = useTrackDrag();

  if (bRolls.length === 0) return null;

  return (
    <TrackLabel label="B-roll" width={width}>
      {bRolls.map((clip) => {
        const left = sourceX(clip.start);
        const right = sourceX(clip.end);
        return (
          <div
            key={clip.id}
            className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded bg-broll px-1.5 text-[10px] text-[#1a1508] select-none ${
              isSelected(selection, "broll", clip.id)
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
                startDrag(e, (dxSec, _dxPx, shiftKey) => {
                  const raw = Math.max(0, origin + dxSec);
                  const snapped = maybeSnapTimelineSec(
                    raw,
                    captions,
                    shiftKey,
                    "start",
                  );
                  const { start, end } = clampRangeEdge("start", snapped, {
                    start: origin,
                    end: fixedEnd,
                  });
                  updateBRollRange(clip.id, start, end, true);
                });
              }}
            />
            {clip.src.split("/").pop()}
            <Handle
              side="right"
              onMouseDown={(e) => {
                const origin = clip.end;
                const fixedStart = clip.start;
                startDrag(e, (dxSec, _dxPx, shiftKey) => {
                  const raw = origin + dxSec;
                  const snapped = maybeSnapTimelineSec(
                    raw,
                    captions,
                    shiftKey,
                    "end",
                  );
                  const { start, end } = clampRangeEdge("end", snapped, {
                    start: fixedStart,
                    end: origin,
                  });
                  updateBRollRange(clip.id, start, end, true);
                });
              }}
            />
          </div>
        );
      })}
    </TrackLabel>
  );
}
