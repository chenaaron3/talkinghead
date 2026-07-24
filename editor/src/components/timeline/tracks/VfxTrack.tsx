import { EMPTY_VFX } from "../../../lib/empty";
import { isSelected } from "../../../lib/selection";
import { clampRangeEdge } from "../../../lib/range";
import { useTimelineSnap } from "../../../lib/use-timeline-snap";
import { vfxClipLabel } from "../../../lib/vfx";
import { useSelection } from "../../../selection-store";
import { useEditor } from "../../../store";
import { Handle, TrackLabel, useTrackDrag } from "../shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
};

export function VfxTrack({ width, sourceX }: Props) {
  const vfx = useEditor((s) => s.config?.vfx ?? EMPTY_VFX).filter(
    (clip) => clip.type !== "listicle-text",
  );
  const selection = useSelection((s) => s.selection);
  const selectVfx = useSelection((s) => s.selectVfx);
  const updateVfxRange = useEditor((s) => s.updateVfxRange);
  const snap = useTimelineSnap();
  const { startDrag } = useTrackDrag();

  if (vfx.length === 0) return null;

  return (
    <TrackLabel label="VFX" width={width}>
      {vfx.map((clip) => {
        const left = sourceX(clip.start);
        const right = sourceX(clip.end);
        return (
          <div
            key={clip.id}
            className={`absolute top-1 bottom-1 flex items-center overflow-hidden rounded bg-vfx px-1.5 text-[10px] text-[#1a1508] select-none ${
              isSelected(selection, "vfx", clip.id)
                ? "z-[2] outline outline-2 outline-white"
                : ""
            }`}
            style={{ left, width: Math.max(8, right - left) }}
            onClick={(e) => {
              e.stopPropagation();
              selectVfx(clip.id);
            }}
          >
            <Handle
              side="left"
              onMouseDown={(e) => {
                const origin = clip.start;
                const fixedEnd = clip.end;
                startDrag(e, (dxSec, _dxPx, shiftKey) => {
                  const raw = Math.max(0, origin + dxSec);
                  const snapped = snap(raw, shiftKey, "start");
                  const { start, end } = clampRangeEdge("start", snapped, {
                    start: origin,
                    end: fixedEnd,
                  });
                  updateVfxRange(clip.id, start, end, true);
                });
              }}
            />
            {vfxClipLabel(clip)}
            <Handle
              side="right"
              onMouseDown={(e) => {
                const origin = clip.end;
                const fixedStart = clip.start;
                startDrag(e, (dxSec, _dxPx, shiftKey) => {
                  const raw = origin + dxSec;
                  const snapped = snap(raw, shiftKey, "end");
                  const { start, end } = clampRangeEdge("end", snapped, {
                    start: fixedStart,
                    end: origin,
                  });
                  updateVfxRange(clip.id, start, end, true);
                });
              }}
            />
          </div>
        );
      })}
    </TrackLabel>
  );
}
