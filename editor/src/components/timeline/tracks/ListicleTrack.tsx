import type { SourceListicleTextVfx } from "@src/lib/types";

import { isListicleItemActive, resolveListicleItems } from "../../../lib/listicle";
import { isSelected } from "../../../lib/selection";
import { clampRangeEdge, MIN_LISTICLE_SEC } from "../../../lib/range";
import { useTimelineSnap } from "../../../lib/use-timeline-snap";
import { useSelection } from "../../../selection-store";
import { useEditor } from "../../../store";
import { Handle, TrackLabel, useTrackDrag } from "../shared";

type Props = {
  width: number;
  sourceX: (sourceSec: number) => number;
};

export function ListicleTrack({ width, sourceX }: Props) {
  const config = useEditor((s) => s.config);
  const listicle = config?.listicleOverlay;
  const items = resolveListicleItems(config);
  const selection = useSelection((s) => s.selection);
  const selectListicleItem = useSelection((s) => s.selectListicleItem);
  const selectVfx = useSelection((s) => s.selectVfx);
  const updateListicleOverlay = useEditor((s) => s.updateListicleOverlay);
  const updateListicleMarkerStart = useEditor(
    (s) => s.updateListicleMarkerStart,
  );
  const updateVfxRange = useEditor((s) => s.updateVfxRange);
  const snap = useTimelineSnap();
  const { startDrag } = useTrackDrag();

  if (!listicle) return null;

  const left = sourceX(listicle.start);
  const right = sourceX(listicle.end);

  const itemSelected = (index: number) =>
    isListicleItemActive(selection, config, index);

  const clipSelected = (clipId: string) =>
    isSelected(selection, "vfx", clipId);

  const renderRangeBar = (
    clip: SourceListicleTextVfx,
    className: string,
    label: string,
  ) => (
    <div
      className={`absolute top-1 bottom-1 z-[1] cursor-pointer rounded px-1 text-[9px] text-white select-none ${className} ${
        clipSelected(clip.id) ? "outline outline-2 outline-white" : ""
      }`}
      style={{
        left: sourceX(clip.start),
        width: Math.max(8, sourceX(clip.end) - sourceX(clip.start)),
      }}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        selectVfx(clip.id);
      }}
    >
      <Handle
        side="left"
        onMouseDown={(e) => {
          e.stopPropagation();
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
      <Handle
        side="right"
        onMouseDown={(e) => {
          e.stopPropagation();
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
              const snapped = snap(raw, shiftKey, "start");
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
              const snapped = snap(raw, shiftKey, "end");
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
      {items.map(({ item, index, marker, reveal }) => (
        <div key={item.id}>
          <div
            className={`absolute top-1 bottom-1 z-[2] flex w-6 cursor-pointer items-center justify-center rounded bg-green-500/70 text-[9px] text-white select-none hover:bg-green-400/80 ${
              itemSelected(index) ? "outline outline-2 outline-white" : ""
            }`}
            style={{ left: sourceX(marker.start) }}
            title={`${index + 1}. ${reveal.text}`}
            onClick={(e) => {
              e.stopPropagation();
              selectListicleItem(index);
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              const origin = marker.start;
              selectListicleItem(index);
              startDrag(e, (dxSec, _dxPx, shiftKey) => {
                const start = snap(origin + dxSec, shiftKey, "start");
                updateListicleMarkerStart(index, start, true);
              });
            }}
          >
            {index + 1}
          </div>
          {renderRangeBar(
            marker,
            "bg-amber-500/60 hover:bg-amber-400/70",
            `Marker: ${marker.text}`,
          )}
          {renderRangeBar(
            reveal,
            "bg-violet-500/60 hover:bg-violet-400/70",
            `Reveal: ${reveal.text}`,
          )}
        </div>
      ))}
    </TrackLabel>
  );
}
