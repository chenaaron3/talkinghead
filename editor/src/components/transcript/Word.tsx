import type { MouseEvent } from 'react';
import { useEffect, useState } from 'react';

import { wordClassName } from '../../lib/word-classes';
import { Asset, useEditor } from '../../store';
import { ListicleBadge } from './ListicleBadge';
import { RangeHandle } from './RangeHandle';

import type { FlatCaption } from "../../lib/captions";
import type { WordAnnotation } from "../../lib/word-annotations";
type Props = {
  caption: FlatCaption;
  annotation: WordAnnotation;
  isResizing: boolean;
  onResizeEnter?: (shiftKey: boolean) => void;
  onStartBrollResize?: (
    e: MouseEvent,
    edge: "start" | "end",
  ) => void;
  onStartPunchInResize?: (
    e: MouseEvent,
    edge: "start" | "end",
  ) => void;
  onStartListicleDrag?: (e: MouseEvent) => void;
  listicleDragging?: boolean;
};

export function Word({
  caption,
  annotation,
  isResizing,
  onResizeEnter,
  onStartBrollResize,
  onStartPunchInResize,
  onStartListicleDrag,
  listicleDragging = false,
}: Props) {
  const sourceSec = useEditor((s) => s.sourceSec);
  const selectedBRollId = useEditor((s) => s.selectedBRollId);
  const selectedPunchInIndex = useEditor((s) => s.selectedPunchInIndex);
  const selectedListicleItemIndex = useEditor(
    (s) => s.selectedListicleItemIndex,
  );
  const seekSource = useEditor((s) => s.seekSource);
  const selectCaption = useEditor((s) => s.selectCaption);
  const selectedCaptionIndex = useEditor((s) => s.selectedCaptionIndex);
  const selectBRoll = useEditor((s) => s.selectBRoll);
  const selectPunchIn = useEditor((s) => s.selectPunchIn);
  const selectListicleItem = useEditor((s) => s.selectListicleItem);
  const setCaptionText = useEditor((s) => s.setCaptionText);
  const setCaptionEmphasis = useEditor((s) => s.setCaptionEmphasis);
  const placeBRollOnCaption = useEditor((s) => s.placeBRollOnCaption);
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
  const inBroll = annotation.bRollId != null;
  const inZoom = annotation.punchInIndex != null;
  const brollSelected = inBroll && selectedBRollId === annotation.bRollId;
  const zoomSelected =
    inZoom && selectedPunchInIndex === annotation.punchInIndex;
  const captionSelected = selectedCaptionIndex === caption.index;

  const isRangeStart = (edge?: WordAnnotation["bRollEdge"]) =>
    edge === "start" || edge === "both";
  const isRangeEnd = (edge?: WordAnnotation["bRollEdge"]) =>
    edge === "end" || edge === "both";

  const showBrollStart =
    brollSelected && isRangeStart(annotation.bRollEdge) && onStartBrollResize;
  const showBrollEnd =
    brollSelected && isRangeEnd(annotation.bRollEdge) && onStartBrollResize;
  const showZoomStart =
    zoomSelected && isRangeStart(annotation.punchInEdge) && onStartPunchInResize;
  const showZoomEnd =
    zoomSelected && isRangeEnd(annotation.punchInEdge) && onStartPunchInResize;

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
      {showBrollStart ? (
        <RangeHandle
          edge="start"
          color="broll"
          onMouseDown={(e) => onStartBrollResize!(e, "start")}
        />
      ) : null}
      {showZoomStart ? (
        <RangeHandle
          edge="start"
          color="zoom"
          onMouseDown={(e) => onStartPunchInResize!(e, "start")}
        />
      ) : null}
      {annotation.listicleNumber != null &&
      annotation.listicleItemIndex != null ? (
        <ListicleBadge
          number={annotation.listicleNumber}
          label={annotation.listicleLabel ?? `Item ${annotation.listicleNumber}`}
          selected={
            selectedListicleItemIndex === annotation.listicleItemIndex
          }
          dragging={listicleDragging}
          onMouseDown={(e) => onStartListicleDrag?.(e)}
        />
      ) : null}
      <span
        className={wordClassName({
          active,
          annotation,
          brollSelected,
          zoomSelected,
          captionSelected,
          emphasis: caption.emphasis,
          isResizing,
        })}
        onMouseEnter={(e) => {
          if (isResizing) onResizeEnter?.(e.shiftKey);
        }}
        onClick={(e) => {
          e.stopPropagation();
          selectCaption(caption.index);
          seekSource(caption.start);
          if (annotation.bRollId) {
            selectBRoll(annotation.bRollId);
          } else if (annotation.punchInIndex != null) {
            selectPunchIn(annotation.punchInIndex);
          } else if (annotation.listicleItemIndex != null) {
            selectListicleItem(annotation.listicleItemIndex);
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
          if (e.dataTransfer.types.includes("application/x-broll-asset")) {
            e.preventDefault();
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const raw = e.dataTransfer.getData("application/x-broll-asset");
          if (!raw) return;
          placeBRollOnCaption(JSON.parse(raw) as Asset, caption);
        }}
        title={`${caption.text}  ${caption.start.toFixed(2)}–${caption.end.toFixed(2)}s`}
      >
        {caption.text}{" "}
      </span>
      {showBrollEnd ? (
        <RangeHandle
          edge="end"
          color="broll"
          onMouseDown={(e) => onStartBrollResize!(e, "end")}
        />
      ) : null}
      {showZoomEnd ? (
        <RangeHandle
          edge="end"
          color="zoom"
          onMouseDown={(e) => onStartPunchInResize!(e, "end")}
        />
      ) : null}

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
