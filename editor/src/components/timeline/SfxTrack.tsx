import { EMPTY_CAPTIONS, EMPTY_SFX } from "../../lib/empty";
import { isSelected } from "../../lib/selection";
import { maybeSnapTimelineSec } from "../../lib/snap";
import { useSelection } from "../../selection-store";
import { useEditor } from "../../store";
import { Handle, TrackLabel, useTrackDrag } from "./shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
};

export function SfxTrack({ width, sourceX }: Props) {
  const sfx = useEditor((s) => s.config?.sfx ?? EMPTY_SFX);
  const captions = useEditor((s) => s.transcript?.captions ?? EMPTY_CAPTIONS);
  const selection = useSelection((s) => s.selection);
  const selectSfx = useSelection((s) => s.selectSfx);
  const updateSfxRange = useEditor((s) => s.updateSfxRange);
  const { startDrag } = useTrackDrag();

  if (sfx.length === 0) return null;

  return (
    <TrackLabel label="SFX" width={width}>
      {sfx.map((clip) => {
        const left = sourceX(clip.start);
        const right = sourceX(clip.end);
        return (
          <div
            key={clip.id}
            className={`absolute top-1 bottom-1 flex cursor-grab items-center overflow-hidden rounded bg-sfx px-1.5 text-[10px] text-[#042f2e] select-none active:cursor-grabbing ${
              isSelected(selection, "sfx", clip.id)
                ? "z-[2] outline outline-2 outline-white"
                : ""
            }`}
            style={{ left, width: Math.max(8, right - left) }}
            onClick={(e) => {
              e.stopPropagation();
              selectSfx(clip.id);
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              const origin = clip.start;
              selectSfx(clip.id);
              startDrag(e, (dxSec, _dxPx, shiftKey) => {
                const raw = Math.max(0, origin + dxSec);
                const snapped = maybeSnapTimelineSec(
                  raw,
                  captions,
                  shiftKey,
                  "start",
                );
                updateSfxRange(clip.id, "start", snapped, true);
              });
            }}
          >
            <Handle
              side="left"
              onMouseDown={(e) => {
                const origin = clip.start;
                startDrag(e, (dxSec, _dxPx, shiftKey) => {
                  const raw = Math.max(0, origin + dxSec);
                  const snapped = maybeSnapTimelineSec(
                    raw,
                    captions,
                    shiftKey,
                    "start",
                  );
                  updateSfxRange(clip.id, "start", snapped, true);
                });
              }}
            />
            {clip.src.split("/").pop()}
            <Handle
              side="right"
              onMouseDown={(e) => {
                const origin = clip.end;
                startDrag(e, (dxSec, _dxPx, shiftKey) => {
                  const raw = origin + dxSec;
                  const snapped = maybeSnapTimelineSec(
                    raw,
                    captions,
                    shiftKey,
                    "end",
                  );
                  updateSfxRange(clip.id, "end", snapped, true);
                });
              }}
            />
          </div>
        );
      })}
    </TrackLabel>
  );
}
