import { useEditor } from "../../store";
import { Handle, TrackLabel, useTrackDrag } from "./shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
  onNeedleX: (x: number | null) => void;
};

export function BRollTrack({ width, sourceX, onNeedleX }: Props) {
  const bRolls = useEditor((s) => s.config?.bRolls ?? []);
  const pxPerSec = useEditor((s) => s.pxPerSec);
  const selectedBRollId = useEditor((s) => s.selectedBRollId);
  const selectBRoll = useEditor((s) => s.selectBRoll);
  const updateBRollRange = useEditor((s) => s.updateBRollRange);
  const seekSource = useEditor((s) => s.seekSource);
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
                const end = clip.end;
                const originX = left;
                startDrag(e, (dx) => {
                  const start = Math.max(0, Math.min(origin + dx / pxPerSec, end - 0.04));
                  updateBRollRange(clip.id, start, end, true);
                  seekSource(start);
                  scrubTo(start, originX + dx);
                });
              }}
            />
            {clip.src.split("/").pop()}
            <Handle
              side="right"
              onMouseDown={(e) => {
                const origin = clip.end;
                const start = clip.start;
                const originX = right;
                startDrag(e, (dx) => {
                  const end = Math.max(start + 0.04, origin + dx / pxPerSec);
                  updateBRollRange(clip.id, start, end, true);
                  seekSource(end);
                  scrubTo(end, originX + dx);
                });
              }}
            />
          </div>
        );
      })}
    </TrackLabel>
  );
}
