import { EMPTY_CAPTIONS } from "../../lib/empty";
import { clampRangeEdge, MIN_LISTICLE_SEC } from "../../lib/range";
import { maybeSnapTimelineSec } from "../../lib/snap";
import { useEditor } from "../../store";
import { Handle, TrackLabel, useTrackDrag } from "./shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
};

export function ListicleTrack({ width, sourceX }: Props) {
  const listicle = useEditor((s) => s.config?.listicleOverlay);
  const captions = useEditor((s) => s.transcript?.captions ?? EMPTY_CAPTIONS);
  const updateListicleOverlay = useEditor((s) => s.updateListicleOverlay);
  const updateListicleItemReveal = useEditor(
    (s) => s.updateListicleItemReveal,
  );
  const { startDrag } = useTrackDrag();

  if (!listicle) return null;

  const left = sourceX(listicle.start);
  const right = sourceX(listicle.end);

  return (
    <TrackLabel label="List" width={width}>
      <div
        className="absolute top-1 bottom-1 rounded bg-green-600/40"
        style={{ left, width: Math.max(8, right - left) }}
        title={`Listicle ${listicle.start.toFixed(2)}–${listicle.end.toFixed(2)}s`}
        onClick={(e) => e.stopPropagation()}
      >
        <Handle
          side="left"
          onMouseDown={(e) => {
            const origin = listicle.start;
            const fixedEnd = listicle.end;
            startDrag(e, (dxSec, _dxPx, shiftKey) => {
              const raw = Math.max(0, origin + dxSec);
              const snapped = maybeSnapTimelineSec(raw, captions, shiftKey);
              const { start, end } = clampRangeEdge(
                "start",
                snapped,
                { start: origin, end: fixedEnd },
                MIN_LISTICLE_SEC,
              );
              updateListicleOverlay(start, end, true);
            });
          }}
        />
        <Handle
          side="right"
          onMouseDown={(e) => {
            const origin = listicle.end;
            const fixedStart = listicle.start;
            startDrag(e, (dxSec, _dxPx, shiftKey) => {
              const raw = origin + dxSec;
              const snapped = maybeSnapTimelineSec(raw, captions, shiftKey);
              const { start, end } = clampRangeEdge(
                "end",
                snapped,
                { start: fixedStart, end: origin },
                MIN_LISTICLE_SEC,
              );
              updateListicleOverlay(start, end, true);
            });
          }}
        />
      </div>
      {listicle.items.map((item, i) => (
        <div
          key={`li-${i}`}
          className="absolute top-1 bottom-1 z-[1] flex w-6 cursor-ew-resize items-center justify-center rounded bg-green-500/70 text-[9px] text-white select-none hover:bg-green-400/80"
          style={{ left: sourceX(item.reveal) }}
          title={`${item.label} @ ${item.reveal.toFixed(2)}s`}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            const origin = item.reveal;
            startDrag(e, (dxSec, _dxPx, shiftKey) => {
              const reveal = maybeSnapTimelineSec(
                origin + dxSec,
                captions,
                shiftKey,
              );
              updateListicleItemReveal(i, reveal, true);
            });
          }}
        >
          {i + 1}
        </div>
      ))}
    </TrackLabel>
  );
}
