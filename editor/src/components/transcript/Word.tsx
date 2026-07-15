import type { MouseEvent } from "react";
import { useEffect, useState } from "react";

import {
  handlesForSelectedRange,
  resolveSelectedRange,
  resolveStyleRange,
  type StartRangeResize,
} from "../../lib/active-range";
import { isSelected } from "../../lib/selection";
import { wordClassName } from "../../lib/word-classes";
import { useSelection } from "../../selection-store";
import { Asset, SfxAsset, useEditor } from "../../store";
import { ListicleBadge } from "./ListicleBadge";
import { BRollBadge } from "./BRollBadge";
import { PunchInBadge } from "./PunchInBadge";
import { SfxBadge } from "./SfxBadge";
import { WordHandleSlot } from "./WordHandleSlot";
import type { MarkerDragging } from "./useRangeResize";

import type { FlatCaption } from "../../lib/captions";
import type { WordAnnotation } from "../../lib/word-annotations";

type Props = {
  caption: FlatCaption;
  annotation: WordAnnotation;
  isResizing: boolean;
  onResizeEnter?: (shiftKey: boolean) => void;
  onStartRangeResize?: StartRangeResize;
  onStartSfxDrag?: (e: MouseEvent, id: string) => void;
  onStartListicleDrag?: (e: MouseEvent) => void;
  draggingStart?: MarkerDragging | null;
  captionIndices: number[];
  onCaptionDragStart?: (e: MouseEvent) => void;
};

export function Word({
  caption,
  annotation,
  isResizing,
  onResizeEnter,
  onStartRangeResize,
  onStartSfxDrag,
  onStartListicleDrag,
  draggingStart = null,
  captionIndices,
  onCaptionDragStart,
}: Props) {
  const sourceSec = useEditor((s) => s.sourceSec);
  const selection = useSelection((s) => s.selection);
  const seekSource = useEditor((s) => s.seekSource);
  const selectCaption = useSelection((s) => s.selectCaption);
  const selectCaptionExtend = useSelection((s) => s.selectCaptionExtend);
  const selectBRoll = useSelection((s) => s.selectBRoll);
  const selectSfx = useSelection((s) => s.selectSfx);
  const selectPunchIn = useSelection((s) => s.selectPunchIn);
  const selectListicleItem = useSelection((s) => s.selectListicleItem);
  const setCaptionText = useEditor((s) => s.setCaptionText);
  const setCaptionEmphasis = useEditor((s) => s.setCaptionEmphasis);
  const placeBRollOnCaption = useEditor((s) => s.placeBRollOnCaption);
  const placeSfxOnCaption = useEditor((s) => s.placeSfxOnCaption);
  const addPunchInOnCaption = useEditor((s) => s.addPunchInOnCaption);
  const cutCaption = useEditor((s) => s.cutCaption);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption.text);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  const active = sourceSec >= caption.start && sourceSec < caption.end;
  const styleRange = resolveStyleRange(annotation, selection);
  const selectedRange = resolveSelectedRange(annotation, selection);
  const { start: startHandle, end: endHandle } = handlesForSelectedRange(
    selectedRange,
    onStartRangeResize,
  );
  const captionSelected = isSelected(selection, "caption", caption.index);

  if (editing) {
    return (
      <input
        className="m-0 inline rounded-sm bg-panel-2 px-0.5 py-px font-[inherit] text-[inherit] leading-[inherit] text-[#e8eaef] outline outline-2 outline-accent"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setCaptionText(caption, draft.trim() || caption.text);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setCaptionText(caption, draft.trim() || caption.text);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        size={Math.max(2, draft.length + 1)}
      />
    );
  }

  return (
    <>
      {annotation.listicleNumber != null &&
      annotation.listicleItemIndex != null ? (
        <ListicleBadge
          number={annotation.listicleNumber}
          label={
            annotation.listicleLabel ?? `Item ${annotation.listicleNumber}`
          }
          selected={isSelected(
            selection,
            "listicleItem",
            annotation.listicleItemIndex!,
          )}
          dragging={
            draggingStart?.kind === "listicle" &&
            draggingStart.id === annotation.listicleItemIndex
          }
          onMouseDown={(e) => onStartListicleDrag?.(e)}
        />
      ) : null}
      {annotation.bRollMarkers?.map((marker) => (
        <BRollBadge
          key={marker.id}
          src={marker.src}
          label={marker.src.split("/").pop() ?? marker.src}
          selected={isSelected(selection, "broll", marker.id)}
          dragging={
            draggingStart?.kind === "broll" && draggingStart.id === marker.id
          }
          onMouseDown={(e) =>
            onStartRangeResize?.(e, "broll", marker.id, "start")
          }
        />
      ))}
      {annotation.punchInMarkers?.map((marker) => (
        <PunchInBadge
          key={`zoom-${marker.index}`}
          selected={isSelected(selection, "punchIn", marker.index)}
          dragging={
            draggingStart?.kind === "zoom" &&
            draggingStart.id === marker.index
          }
          onMouseDown={(e) =>
            onStartRangeResize?.(e, "zoom", marker.index, "start")
          }
        />
      ))}
      {annotation.sfx?.map((marker) => (
        <SfxBadge
          key={marker.id}
          label={marker.label}
          selected={isSelected(selection, "sfx", marker.id)}
          dragging={
            draggingStart?.kind === "sfx" && draggingStart.id === marker.id
          }
          onMouseDown={(e) => onStartSfxDrag?.(e, marker.id)}
        />
      ))}
      <WordHandleSlot edge="start" handle={startHandle} />
      <span
        data-caption-index={caption.index}
        className={wordClassName({
          active,
          styleRange,
          captionSelected,
          emphasis: caption.emphasis,
          isResizing,
        })}
        onMouseEnter={(e) => {
          if (isResizing) onResizeEnter?.(e.shiftKey);
        }}
        onMouseDown={(e) => onCaptionDragStart?.(e)}
        onClick={(e) => {
          e.stopPropagation();
          if (e.shiftKey) {
            selectCaptionExtend(caption.index, captionIndices);
          } else if (e.metaKey || e.ctrlKey) {
            selectCaption(caption.index, "toggle");
          } else {
            selectCaption(caption.index);
          }
          seekSource(caption.start);
          if (annotation.bRollId) {
            selectBRoll(annotation.bRollId);
          } else if (annotation.punchInIndex != null) {
            selectPunchIn(annotation.punchInIndex);
          } else if (annotation.listicleItemIndex != null) {
            selectListicleItem(annotation.listicleItemIndex);
          } else if (annotation.sfxRanges?.[0]) {
            selectSfx(annotation.sfxRanges[0].id);
          } else if (annotation.sfx?.[0]) {
            selectSfx(annotation.sfx[0].id);
          }
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setDraft(caption.text);
          setEditing(true);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenu({ x: e.clientX, y: e.clientY });
        }}
        onDragOver={(e) => {
          const types = e.dataTransfer.types;
          if (
            types.includes("application/x-broll-asset") ||
            types.includes("application/x-sfx-asset")
          ) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const sfxRaw = e.dataTransfer.getData("application/x-sfx-asset");
          if (sfxRaw) {
            placeSfxOnCaption(JSON.parse(sfxRaw) as SfxAsset, caption);
            return;
          }
          const raw = e.dataTransfer.getData("application/x-broll-asset");
          if (!raw) return;
          placeBRollOnCaption(JSON.parse(raw) as Asset, caption);
        }}
        title={`${caption.text}  ${caption.start.toFixed(2)}–${caption.end.toFixed(2)}s`}
      >
        {caption.text}
      </span>
      <WordHandleSlot edge="end" handle={endHandle} />

      {menu ? (
        <div
          className="fixed z-50 min-w-[140px] rounded-lg border border-border bg-panel-2 p-1 shadow-xl"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {(
            [
              ["Emphasis: positive", "positive"],
              ["Emphasis: negative", "negative"],
              ["Clear emphasis", undefined],
            ] as const
          ).map(([label, value]) => (
            <button
              key={label}
              type="button"
              className="block w-full rounded px-2.5 py-2 text-left hover:bg-[#3d4a66]"
              onClick={() => {
                setCaptionEmphasis(caption, value);
                setMenu(null);
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className="block w-full rounded px-2.5 py-2 text-left hover:bg-[#3d4a66]"
            onClick={() => {
              addPunchInOnCaption(caption);
              setMenu(null);
            }}
          >
            Zoom
          </button>
          <button
            type="button"
            className="block w-full rounded px-2.5 py-2 text-left text-red-300 hover:bg-[#3d4a66]"
            onClick={() => {
              cutCaption(caption);
              setMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </>
  );
}
