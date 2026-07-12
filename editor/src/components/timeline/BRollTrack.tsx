import { useEditor } from "../../store";
import { Handle, TrackLabel, useTrackDrag } from "./shared";

type Props = {
  width: number;
  outputX: (outputFrame: number) => number;
  onNeedleX: (x: number | null) => void;
};

export function BRollTrack({ width, outputX, onNeedleX }: Props) {
  const bRolls = useEditor((s) => s.props?.bRolls ?? []);
  const selectedBRollId = useEditor((s) => s.selectedBRollId);
  const selectBRoll = useEditor((s) => s.selectBRoll);
  const updateBRollRange = useEditor((s) => s.updateBRollRange);
  const { startDrag, scrubTo } = useTrackDrag(onNeedleX);

  return (
    <TrackLabel label="B-roll" width={width}>
      {bRolls.map((clip) => {
        const left = outputX(clip.startFrame);
        const right = outputX(clip.endFrame);
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
                const origin = clip.startFrame;
                const end = clip.endFrame;
                const originX = left;
                startDrag(e, (dx, dxPx) => {
                  const start = Math.max(0, Math.min(origin + dx, end - 1));
                  updateBRollRange(clip.id, start, end, true);
                  scrubTo(start, originX + dxPx);
                });
              }}
            />
            {clip.src.split("/").pop()}
            <Handle
              side="right"
              onMouseDown={(e) => {
                const origin = clip.endFrame;
                const start = clip.startFrame;
                const originX = right;
                startDrag(e, (dx, dxPx) => {
                  const end = Math.max(start + 1, origin + dx);
                  updateBRollRange(clip.id, start, end, true);
                  scrubTo(Math.max(start, end - 1), originX + dxPx);
                });
              }}
            />
          </div>
        );
      })}
    </TrackLabel>
  );
}
