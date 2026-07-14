import { useEffect, useState, type MouseEvent } from "react";
import type { SourceBRoll } from "@src/lib/types";
import type { FlatCaption } from "../../lib/captions";
import { clampRangeEdge } from "../../lib/range";
import { maybeSnapTimelineSec } from "../../lib/snap";
import { useEditor } from "../../store";

export type RangeResize =
  | { kind: "broll"; id: string; edge: "start" | "end" }
  | { kind: "punchin"; index: number; edge: "start" | "end" }
  | { kind: "listicle"; itemIndex: number };

export function useRangeResize() {
  const bRolls = useEditor((s) => s.config?.bRolls ?? []);
  const punchIns = useEditor((s) => s.config?.punchInSegments ?? []);
  const captions = useEditor((s) => s.transcript?.captions ?? []);
  const seekSource = useEditor((s) => s.seekSource);
  const selectBRoll = useEditor((s) => s.selectBRoll);
  const selectPunchIn = useEditor((s) => s.selectPunchIn);
  const selectListicleItem = useEditor((s) => s.selectListicleItem);
  const updateBRollRange = useEditor((s) => s.updateBRollRange);
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
      updateListicleItemReveal(resize.itemIndex, reveal, true);
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

    const seg = punchIns[resize.index];
    if (!seg) return;
    const value = resize.edge === "start" ? caption.start : caption.end;
    const { start, end } = clampRangeEdge(resize.edge, value, seg);
    updatePunchInRange(resize.index, start, end, true);
    seekSource(resize.edge === "start" ? start : end);
  };

  const startBrollResize = (
    e: MouseEvent,
    clip: SourceBRoll,
    edge: "start" | "end",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    beginGesture();
    selectBRoll(clip.id);
    setResize({ kind: "broll", id: clip.id, edge });
    seekSource(edge === "start" ? clip.start : clip.end);
  };

  const startPunchInResize = (
    e: MouseEvent,
    index: number,
    edge: "start" | "end",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const seg = punchIns[index];
    if (!seg) return;
    beginGesture();
    selectPunchIn(index);
    setResize({ kind: "punchin", index, edge });
    seekSource(edge === "start" ? seg.start : seg.end);
  };

  const startListicleDrag = (e: MouseEvent, itemIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const item = useEditor.getState().config?.listicleOverlay?.items[itemIndex];
    if (!item) return;
    beginGesture();
    selectListicleItem(itemIndex);
    setResize({ kind: "listicle", itemIndex });
    seekSource(item.reveal);
  };

  return {
    resize,
    snapToCaption,
    startBrollResize,
    startPunchInResize,
    startListicleDrag,
  };
}
