import type { MouseEvent } from "react";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";

import {
  handlesForSelectedRange,
  resolveSelectedRange,
  resolveStyleRange,
  type StartRangeResize,
} from "../../../lib/active-range";
import { isSelected } from "../../../lib/selection";
import { wordClassName } from "../../../lib/word-classes";
import { useSelection } from "../../../selection-store";
import { LibraryAsset, SfxAsset, VfxPreset, useEditor } from "../../../store";
import { BRollBadge } from "../badge/BRollBadge";
import { ListicleBadge } from "../badge/ListicleBadge";
import { PunchInBadge } from "../badge/PunchInBadge";
import { SfxBadge } from "../badge/SfxBadge";
import { VfxBadge } from "../badge/VfxBadge";
import type { MarkerDragging } from "../hooks/useRangeResize";
import { WordContextMenu } from "../WordContextMenu";
import { WordHandleSlot } from "../WordHandleSlot";

import type { FlatCaption } from "../../../lib/captions";
import type { WordAnnotation } from "../../../lib/word-annotations";

type Props = {
  caption: FlatCaption;
  annotation: WordAnnotation;
  scissorMode?: boolean;
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
  scissorMode = false,
  isResizing,
  onResizeEnter,
  onStartRangeResize,
  onStartSfxDrag,
  onStartListicleDrag,
  draggingStart = null,
  captionIndices,
  onCaptionDragStart,
}: Props) {
  // Perf: this component renders once per transcript word, and the stores
  // update every frame during playback. Subscribe to derived primitives only,
  // so a word re-renders when *its* state changes — never on every frame.
  const active = useEditor(
    (s) => s.sourceSec >= caption.start && s.sourceSec < caption.end,
  );
  const styleRange = useSelection(
    useShallow((s) => resolveStyleRange(annotation, s.selection)),
  );
  const selectedRange = useSelection(
    useShallow((s) => resolveSelectedRange(annotation, s.selection)),
  );
  const captionSelected = useSelection((s) =>
    isSelected(s.selection, "caption", caption.index),
  );
  const listicleSelected = useSelection(
    (s) =>
      annotation.listicleItemIndex != null &&
      isSelected(s.selection, "listicleItem", annotation.listicleItemIndex),
  );
  const bRollSelected = useSelection(
    useShallow((s) =>
      (annotation.bRollMarkers ?? []).map((m) =>
        isSelected(s.selection, "broll", m.id),
      ),
    ),
  );
  const vfxSelected = useSelection(
    useShallow((s) =>
      (annotation.vfxMarkers ?? []).map((m) =>
        isSelected(s.selection, "vfx", m.id),
      ),
    ),
  );
  const punchInSelected = useSelection(
    useShallow((s) =>
      (annotation.punchInMarkers ?? []).map((m) =>
        isSelected(s.selection, "punchIn", m.index),
      ),
    ),
  );
  const sfxSelected = useSelection(
    useShallow((s) =>
      (annotation.sfx ?? []).map((m) => isSelected(s.selection, "sfx", m.id)),
    ),
  );
  const seekSource = useEditor((s) => s.seekSource);
  const selectCaption = useSelection((s) => s.selectCaption);
  const selectCaptionExtend = useSelection((s) => s.selectCaptionExtend);
  const selectBRoll = useSelection((s) => s.selectBRoll);
  const selectVfx = useSelection((s) => s.selectVfx);
  const selectSfx = useSelection((s) => s.selectSfx);
  const selectPunchIn = useSelection((s) => s.selectPunchIn);
  const selectListicleItem = useSelection((s) => s.selectListicleItem);
  const setCaptionText = useEditor((s) => s.setCaptionText);
  const setCaptionEmphasis = useEditor((s) => s.setCaptionEmphasis);
  const placeBRollOnCaption = useEditor((s) => s.placeBRollOnCaption);
  const placeVfxOnCaption = useEditor((s) => s.placeVfxOnCaption);
  const placeSfxOnCaption = useEditor((s) => s.placeSfxOnCaption);
  const addPunchInOnCaption = useEditor((s) => s.addPunchInOnCaption);
  const cutCaption = useEditor((s) => s.cutCaption);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption.text);

  const { start: startHandle, end: endHandle } = handlesForSelectedRange(
    selectedRange,
    onStartRangeResize,
  );

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
          selected={listicleSelected}
          dragging={
            draggingStart?.kind === "listicle" &&
            draggingStart.id === annotation.listicleItemIndex
          }
          onMouseDown={(e) => onStartListicleDrag?.(e)}
        />
      ) : null}
      {annotation.bRollMarkers?.map((marker, i) => (
        <BRollBadge
          key={marker.id}
          src={marker.src}
          label={marker.src.split("/").pop() ?? marker.src}
          selected={bRollSelected[i] ?? false}
          dragging={
            draggingStart?.kind === "broll" && draggingStart.id === marker.id
          }
          onMouseDown={(e) =>
            onStartRangeResize?.(e, "broll", marker.id, "start")
          }
        />
      ))}
      {annotation.vfxMarkers?.map((marker, i) => (
        <VfxBadge
          key={marker.id}
          label={marker.label}
          kind={marker.type}
          selected={vfxSelected[i] ?? false}
          dragging={
            draggingStart?.kind === "vfx" && draggingStart.id === marker.id
          }
          onMouseDown={(e) =>
            onStartRangeResize?.(e, "vfx", marker.id, "start")
          }
        />
      ))}
      {annotation.punchInMarkers?.map((marker, i) => (
        <PunchInBadge
          key={`zoom-${marker.index}`}
          selected={punchInSelected[i] ?? false}
          dragging={
            draggingStart?.kind === "zoom" &&
            draggingStart.id === marker.index
          }
          onMouseDown={(e) =>
            onStartRangeResize?.(e, "zoom", marker.index, "start")
          }
        />
      ))}
      {annotation.sfx?.map((marker, i) => (
        <SfxBadge
          key={marker.id}
          label={marker.label}
          selected={sfxSelected[i] ?? false}
          dragging={
            draggingStart?.kind === "sfx" && draggingStart.id === marker.id
          }
          onMouseDown={(e) => onStartSfxDrag?.(e, marker.id)}
        />
      ))}
      <WordHandleSlot edge="start" handle={startHandle} />
      <WordContextMenu
        disabled={scissorMode}
        emphasis={caption.emphasis}
        onEmphasis={(emphasis) => setCaptionEmphasis(caption, emphasis)}
        onZoom={() => addPunchInOnCaption(caption)}
        onDelete={() => cutCaption(caption)}
      >
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
            if (scissorMode) {
              cutCaption(caption);
              return;
            }
            if (e.shiftKey) {
              selectCaptionExtend(caption.index, captionIndices);
            } else if (e.metaKey || e.ctrlKey) {
              selectCaption(caption.index, "toggle");
            } else {
              selectCaption(caption.index);
            }
            seekSource(caption.start);
            if (annotation.vfxRanges?.[0]) {
              selectVfx(annotation.vfxRanges[0].id);
            } else if (annotation.bRollRanges?.[0]) {
              selectBRoll(annotation.bRollRanges[0].id);
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
            if (scissorMode) return;
            e.stopPropagation();
            setDraft(caption.text);
            setEditing(true);
          }}
          onDragOver={(e) => {
            if (scissorMode) return;
            const types = e.dataTransfer.types;
            if (
              types.includes("application/x-broll-asset") ||
              types.includes("application/x-vfx-preset") ||
              types.includes("application/x-sfx-asset")
            ) {
              e.preventDefault();
            }
          }}
          onDrop={(e) => {
            if (scissorMode) return;
            e.preventDefault();
            const sfxRaw = e.dataTransfer.getData("application/x-sfx-asset");
            if (sfxRaw) {
              placeSfxOnCaption(JSON.parse(sfxRaw) as SfxAsset, caption);
              return;
            }
            const vfxRaw = e.dataTransfer.getData("application/x-vfx-preset");
            if (vfxRaw) {
              placeVfxOnCaption(JSON.parse(vfxRaw) as VfxPreset, caption);
              return;
            }
            const raw = e.dataTransfer.getData("application/x-broll-asset");
            if (!raw) return;
            placeBRollOnCaption(JSON.parse(raw) as LibraryAsset, caption);
          }}
          title={`${caption.text}  ${caption.start.toFixed(2)}–${caption.end.toFixed(2)}s`}
        >
          {caption.text}
        </span>
      </WordContextMenu>
      <WordHandleSlot edge="end" handle={endHandle} />
    </>
  );
}
