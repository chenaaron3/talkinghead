import { useEffect, useState, type MouseEvent } from "react";
import type { FlatCaption } from "../../../lib/captions";
import type { RangeKind } from "../../../lib/active-range";
import { clampRangeEdge } from "../../../lib/range";
import { maybeSnapTimelineSec } from "../../../lib/snap";
import {
  EMPTY_BROLLS,
  EMPTY_CAPTIONS,
  EMPTY_PUNCH_INS,
  EMPTY_SFX,
  EMPTY_VFX,
} from "../../../lib/empty";
import { useSelection } from "../../../selection-store";
import { useEditor } from "../../../store";

export type RangeResize =
  | { kind: "broll"; id: string; edge: "start" | "end" }
  | { kind: "vfx"; id: string; edge: "start" | "end" }
  | { kind: "sfx"; id: string; edge: "start" | "end" }
  | { kind: "zoom"; id: number; edge: "start" | "end" }
  | { kind: "listicle"; id: number };

/** Active start-marker drag (listicle is always a point/start drag). */
export type MarkerDragging = {
  kind: RangeResize["kind"];
  id: string | number;
};

export function markerDraggingFromResize(
  resize: RangeResize | null,
): MarkerDragging | null {
  if (!resize) return null;
  if (resize.kind === "listicle") {
    return { kind: "listicle", id: resize.id };
  }
  if (resize.edge === "start") {
    return { kind: resize.kind, id: resize.id };
  }
  return null;
}

export function useRangeResize() {
  const bRolls = useEditor((s) => s.config?.bRolls ?? EMPTY_BROLLS);
  const vfx = useEditor((s) => s.config?.vfx ?? EMPTY_VFX);
  const sfx = useEditor((s) => s.config?.sfx ?? EMPTY_SFX);
  const punchIns = useEditor((s) => s.config?.punchInSegments ?? EMPTY_PUNCH_INS);
  const captions = useEditor((s) => s.transcript?.captions ?? EMPTY_CAPTIONS);
  const seekSource = useEditor((s) => s.seekSource);
  const selectBRoll = useSelection((s) => s.selectBRoll);
  const selectVfx = useSelection((s) => s.selectVfx);
  const selectSfx = useSelection((s) => s.selectSfx);
  const selectPunchIn = useSelection((s) => s.selectPunchIn);
  const selectListicleItem = useSelection((s) => s.selectListicleItem);
  const updateBRollRange = useEditor((s) => s.updateBRollRange);
  const updateVfxRange = useEditor((s) => s.updateVfxRange);
  const updateSfxRange = useEditor((s) => s.updateSfxRange);
  const updatePunchInRange = useEditor((s) => s.updatePunchInRange);
  const updateListicleItemReveal = useEditor(
    (s) => s.updateListicleItemReveal,
  );
  const beginGesture = useEditor((s) => s.beginGesture);

  const [resize, setResize] = useState<RangeResize | null>(null);

  useEffect(() => {
    if (!resize) return;
    const onUp = () => setResize(null);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [resize]);

  const snapToCaption = (caption: FlatCaption, shiftKey = false) => {
    if (!resize) return;

    if (resize.kind === "listicle") {
      const reveal = maybeSnapTimelineSec(
        caption.start,
        captions,
        shiftKey,
      );
      updateListicleItemReveal(resize.id, reveal, true);
      seekSource(reveal);
      return;
    }

    if (resize.kind === "broll") {
      const clip = bRolls.find((c) => c.id === resize.id);
      if (!clip) return;
      const value =
        resize.edge === "start" ? caption.start : caption.end;
      const { start, end } = clampRangeEdge(resize.edge, value, clip);
      updateBRollRange(clip.id, start, end, true);
      seekSource(resize.edge === "start" ? start : end);
      return;
    }

    if (resize.kind === "vfx") {
      const clip = vfx.find((c) => c.id === resize.id);
      if (!clip) return;
      const value =
        resize.edge === "start" ? caption.start : caption.end;
      const { start, end } = clampRangeEdge(resize.edge, value, clip);
      updateVfxRange(clip.id, start, end, true);
      seekSource(resize.edge === "start" ? start : end);
      return;
    }

    if (resize.kind === "sfx") {
      const value =
        resize.edge === "start"
          ? maybeSnapTimelineSec(caption.start, captions, shiftKey)
          : caption.end;
      updateSfxRange(resize.id, resize.edge, value, true);
      const next = useEditor
        .getState()
        .config?.sfx?.find((c) => c.id === resize.id);
      if (next) {
        seekSource(resize.edge === "start" ? next.start : next.end);
      }
      return;
    }

    const seg = punchIns[resize.id];
    if (!seg) return;
    const value = resize.edge === "start" ? caption.start : caption.end;
    const { start, end } = clampRangeEdge(resize.edge, value, seg);
    updatePunchInRange(resize.id, start, end, true);
    seekSource(resize.edge === "start" ? start : end);
  };

  const startRangeResize = (
    e: MouseEvent,
    kind: RangeKind,
    id: string | number,
    edge: "start" | "end",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    beginGesture();

    if (kind === "broll") {
      const clipId = String(id);
      const clip = bRolls.find((c) => c.id === clipId);
      if (!clip) return;
      selectBRoll(clipId);
      setResize({ kind: "broll", id: clipId, edge });
      seekSource(edge === "start" ? clip.start : clip.end);
      return;
    }

    if (kind === "vfx") {
      const clipId = String(id);
      const clip = vfx.find((c) => c.id === clipId);
      if (!clip) return;
      selectVfx(clipId);
      setResize({ kind: "vfx", id: clipId, edge });
      seekSource(edge === "start" ? clip.start : clip.end);
      return;
    }

    if (kind === "sfx") {
      const clipId = String(id);
      const clip = sfx.find((c) => c.id === clipId);
      if (!clip) return;
      selectSfx(clipId);
      setResize({ kind: "sfx", id: clipId, edge });
      seekSource(edge === "start" ? clip.start : clip.end);
      return;
    }

    const index = Number(id);
    const seg = punchIns[index];
    if (!seg) return;
    selectPunchIn(index);
    setResize({ kind: "zoom", id: index, edge });
    seekSource(edge === "start" ? seg.start : seg.end);
  };

  const startSfxDrag = (e: MouseEvent, id: string) => {
    startRangeResize(e, "sfx", id, "start");
  };

  const startListicleDrag = (e: MouseEvent, itemIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const item = useEditor.getState().config?.listicleOverlay?.items[itemIndex];
    if (!item) return;
    beginGesture();
    selectListicleItem(itemIndex);
    setResize({ kind: "listicle", id: itemIndex });
    seekSource(item.reveal);
  };

  return {
    resize,
    snapToCaption,
    startRangeResize,
    startSfxDrag,
    startListicleDrag,
  };
}
