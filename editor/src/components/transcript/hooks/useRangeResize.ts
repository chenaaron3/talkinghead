import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { cutsToKeepRegions } from "@src/lib/timeline/source-timeline";
import type { FlatCaption } from "../../../lib/captions";
import { isClipVfxRangeKind, type RangeKind } from "../../../lib/active-range";
import {
  captionForEndEdge,
  captionForStartEdge,
  linkedTargetsOnCaptionEdge,
  type LinkedEdgeTarget,
} from "../../../lib/linked-caption-edges";
import { clampRangeEdge } from "../../../lib/range";
import { snapTranscriptCaptionEdge } from "../../../lib/snap";
import {
  EMPTY_BROLLS,
  EMPTY_CAPTIONS,
  EMPTY_CUTS,
  EMPTY_PUNCH_INS,
  EMPTY_SFX,
} from "../../../lib/empty";
import { useSelection } from "../../../selection-store";
import { useEditor } from "../../../store";

export type RangeResize =
  | {
      kind: "broll";
      id: string;
      edge: "start" | "end";
      linked: LinkedEdgeTarget[];
    }
  | {
      kind: "vfx" | "listicleMarker" | "listicleReveal";
      id: string;
      edge: "start" | "end";
      linked: LinkedEdgeTarget[];
    }
  | {
      kind: "sfx";
      id: string;
      edge: "start" | "end";
      linked: LinkedEdgeTarget[];
    }
  | {
      kind: "zoom";
      id: number;
      edge: "start" | "end";
      linked: LinkedEdgeTarget[];
    }
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

function linkedForEdge(
  edge: "start" | "end",
  sec: number,
  exclude: LinkedEdgeTarget,
  captions: FlatCaption[],
): LinkedEdgeTarget[] {
  const config = useEditor.getState().config;
  if (!config) return [];
  const caption =
    edge === "start"
      ? captionForStartEdge(captions, sec)
      : captionForEndEdge(captions, sec);
  if (!caption) return [];
  return linkedTargetsOnCaptionEdge(config, caption, edge, exclude);
}

export function useRangeResize() {
  const bRolls = useEditor((s) => s.config?.bRolls ?? EMPTY_BROLLS);
  const sfx = useEditor((s) => s.config?.sfx ?? EMPTY_SFX);
  const punchIns = useEditor((s) => s.config?.punchInSegments ?? EMPTY_PUNCH_INS);
  const captions = useEditor((s) => s.transcript?.captions ?? EMPTY_CAPTIONS);
  const cuts = useEditor((s) => s.config?.cuts ?? EMPTY_CUTS);
  const duration = useEditor((s) => s.transcript?.duration ?? 0);
  const keeps = useMemo(
    () => cutsToKeepRegions(cuts, duration),
    [cuts, duration],
  );
  const indexedCaptions = useMemo(
    () => captions.map((c, index) => ({ ...c, index })),
    [captions],
  );
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
  const updateListicleMarkerStart = useEditor(
    (s) => s.updateListicleMarkerStart,
  );
  const beginGesture = useEditor((s) => s.beginGesture);

  const [resize, setResize] = useState<RangeResize | null>(null);

  useEffect(() => {
    if (!resize) return;
    const onUp = () => setResize(null);
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [resize]);

  const applyEdge = (
    target: LinkedEdgeTarget,
    edge: "start" | "end",
    value: number,
  ) => {
    if (target.kind === "broll") {
      const clip = useEditor
        .getState()
        .config?.bRolls.find((c) => c.id === target.id);
      if (!clip) return;
      const { start, end } = clampRangeEdge(edge, value, clip);
      updateBRollRange(clip.id, start, end, true);
      return;
    }
    if (target.kind === "vfx") {
      const clip = useEditor.getState().config?.vfx?.find((c) => c.id === target.id);
      if (!clip) return;
      const { start, end } = clampRangeEdge(edge, value, clip);
      updateVfxRange(clip.id, start, end, true);
      return;
    }
    if (target.kind === "sfx") {
      updateSfxRange(target.id, edge, value, true);
      return;
    }
    const seg = useEditor.getState().config?.punchInSegments[target.id];
    if (!seg) return;
    const { start, end } = clampRangeEdge(edge, value, seg);
    updatePunchInRange(target.id, start, end, true);
  };

  const snapToCaption = (caption: FlatCaption, shiftKey = false) => {
    if (!resize) return;

    if (resize.kind === "listicle") {
      const start = snapTranscriptCaptionEdge(
        caption,
        "start",
        indexedCaptions,
        keeps,
      );
      updateListicleMarkerStart(resize.id, start, true);
      seekSource(start);
      return;
    }

    const value = snapTranscriptCaptionEdge(
      caption,
      resize.edge,
      indexedCaptions,
      keeps,
    );

    const primary: LinkedEdgeTarget =
      resize.kind === "zoom"
        ? { kind: "zoom", id: resize.id }
        : isClipVfxRangeKind(resize.kind)
          ? { kind: "vfx", id: String(resize.id) }
          : { kind: resize.kind, id: String(resize.id) };

    applyEdge(primary, resize.edge, value);

    if (shiftKey) {
      for (const target of resize.linked) {
        applyEdge(target, resize.edge, value);
      }
    }

    seekSource(value);
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
      const sec = edge === "start" ? clip.start : clip.end;
      const linked = linkedForEdge(
        edge,
        sec,
        { kind: "broll", id: clipId },
        indexedCaptions,
      );
      setResize({ kind: "broll", id: clipId, edge, linked });
      seekSource(sec);
      return;
    }

    if (isClipVfxRangeKind(kind)) {
      const clipId = String(id);
      const config = useEditor.getState().config;
      const clip = config?.vfx?.find((c) => c.id === clipId);
      if (!clip) return;
      selectVfx(clipId);
      const sec = edge === "start" ? clip.start : clip.end;
      const linked = linkedForEdge(
        edge,
        sec,
        { kind: "vfx", id: clipId },
        indexedCaptions,
      );
      setResize({ kind, id: clipId, edge, linked });
      seekSource(sec);
      return;
    }

    if (kind === "sfx") {
      const clipId = String(id);
      const clip = sfx.find((c) => c.id === clipId);
      if (!clip) return;
      selectSfx(clipId);
      const sec = edge === "start" ? clip.start : clip.end;
      const linked = linkedForEdge(
        edge,
        sec,
        { kind: "sfx", id: clipId },
        indexedCaptions,
      );
      setResize({ kind: "sfx", id: clipId, edge, linked });
      seekSource(sec);
      return;
    }

    const index = Number(id);
    const seg = punchIns[index];
    if (!seg) return;
    selectPunchIn(index);
    const sec = edge === "start" ? seg.start : seg.end;
    const linked = linkedForEdge(
      edge,
      sec,
      { kind: "zoom", id: index },
      indexedCaptions,
    );
    setResize({ kind: "zoom", id: index, edge, linked });
    seekSource(sec);
  };

  const startSfxDrag = (e: MouseEvent, id: string) => {
    startRangeResize(e, "sfx", id, "start");
  };

  const startListicleDrag = (e: MouseEvent, itemIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    const config = useEditor.getState().config;
    const item = config?.listicleOverlay?.items[itemIndex];
    if (!item) return;
    const marker = config?.vfx?.find((c) => c.id === item.markerId);
    if (!marker) return;
    beginGesture();
    selectListicleItem(itemIndex);
    setResize({ kind: "listicle", id: itemIndex });
    seekSource(marker.start);
  };

  return {
    resize,
    snapToCaption,
    startRangeResize,
    startSfxDrag,
    startListicleDrag,
  };
}
