import type { MouseEvent } from "react";

import { isSelected } from './selection';

import type { Selection } from "./selection";

import type { RangeEdge, WordAnnotation } from "./word-annotations";

export type RangeKind =
  | "broll"
  | "vfx"
  | "sfx"
  | "zoom"
  | "listicleMarker"
  | "listicleReveal";

/** Range kinds backed by a clip id in `config.vfx` (including listicle-text). */
export function isClipVfxRangeKind(
  kind: RangeKind,
): kind is "vfx" | "listicleMarker" | "listicleReveal" {
  return (
    kind === "vfx" || kind === "listicleMarker" || kind === "listicleReveal"
  );
}

export type HandleConfig = {
  kind: RangeKind;
  onMouseDown: (e: MouseEvent) => void;
};

export type ActiveRange = {
  kind: RangeKind;
  id: string | number;
  edge: RangeEdge;
  selected: boolean;
};

export type StartRangeResize = (
  e: MouseEvent,
  kind: RangeKind,
  id: string | number,
  edge: "start" | "end",
) => void;

function isStartEdge(edge: RangeEdge): boolean {
  return edge === "start" || edge === "both";
}

function isEndEdge(edge: RangeEdge): boolean {
  return edge === "end" || edge === "both";
}

function selectedListicleItemIndex(
  selection: Selection | null,
): number | null {
  if (selection?.kind !== "listicleItem") return null;
  const id = selection.ids[0];
  return typeof id === "number" ? id : null;
}

function listicleRangeForWord(
  annotation: WordAnnotation,
  role: "marker" | "reveal",
  selected: boolean,
): ActiveRange | null {
  const range =
    role === "marker"
      ? annotation.listicleMarkerRange
      : annotation.listicleRevealRange;
  if (!range) return null;
  return {
    kind: role === "marker" ? "listicleMarker" : "listicleReveal",
    id: range.id,
    edge: range.edge,
    selected,
  };
}

function listicleRangeFromVfxId(
  annotation: WordAnnotation,
  vfxId: string,
): ActiveRange | null {
  if (annotation.listicleRevealRange?.id === vfxId) {
    return listicleRangeForWord(annotation, "reveal", true);
  }
  if (annotation.listicleMarkerRange?.id === vfxId) {
    return listicleRangeForWord(annotation, "marker", true);
  }
  return null;
}

function selectedListicleTextVfxId(
  selection: Selection | null,
): string | null {
  if (selection?.kind !== "vfx") return null;
  const id = selection.ids[0];
  return typeof id === "string" ? id : null;
}

function listicleStyleRange(
  annotation: WordAnnotation,
  selection: Selection | null,
): ActiveRange | null {
  const vfxId = selectedListicleTextVfxId(selection);
  if (vfxId) {
    const fromClip = listicleRangeFromVfxId(annotation, vfxId);
    if (fromClip) return fromClip;
  }

  const selectedItem = selectedListicleItemIndex(selection);
  if (selectedItem == null) return null;

  const marker =
    annotation.listicleMarkerRange?.itemIndex === selectedItem
      ? listicleRangeForWord(annotation, "marker", true)
      : null;
  const reveal =
    annotation.listicleRevealRange?.itemIndex === selectedItem
      ? listicleRangeForWord(annotation, "reveal", true)
      : null;

  // Prefer reveal tint when both ranges cover the same word (rare overlap).
  return reveal ?? marker;
}

/**
 * Range covering this word for transcript tint.
 * Priority: vfx > b-roll > selected sfx > zoom.
 */
export function resolveStyleRange(
  annotation: WordAnnotation,
  selection: Selection | null,
): ActiveRange | null {
  const listicleRange = listicleStyleRange(annotation, selection);
  if (listicleRange) return listicleRange;

  const vfx = annotation.vfxRanges;
  if (vfx && vfx.length > 0) {
    const selected = vfx.find((r) => isSelected(selection, "vfx", r.id));
    const pick = selected ?? vfx[0]!;
    return {
      kind: "vfx",
      id: pick.id,
      edge: pick.edge,
      selected: selected != null,
    };
  }

  const bRolls = annotation.bRollRanges;
  if (bRolls && bRolls.length > 0) {
    const selected = bRolls.find((r) => isSelected(selection, "broll", r.id));
    const pick = selected ?? bRolls[0]!;
    return {
      kind: "broll",
      id: pick.id,
      edge: pick.edge,
      selected: selected != null,
    };
  }

  const sfx = annotation.sfxRanges?.find((r) =>
    isSelected(selection, "sfx", r.id),
  );
  if (sfx) {
    return {
      kind: "sfx",
      id: sfx.id,
      edge: sfx.edge,
      selected: true,
    };
  }

  if (annotation.punchInIndex != null && annotation.punchInEdge) {
    return {
      kind: "zoom",
      id: annotation.punchInIndex,
      edge: annotation.punchInEdge,
      selected: isSelected(selection, "punchIn", annotation.punchInIndex),
    };
  }

  return null;
}

function listicleSelectedRange(
  annotation: WordAnnotation,
  selection: Selection | null,
): ActiveRange | null {
  const vfxId = selectedListicleTextVfxId(selection);
  if (vfxId) {
    const fromClip = listicleRangeFromVfxId(annotation, vfxId);
    if (fromClip) return fromClip;
  }

  const selectedItem = selectedListicleItemIndex(selection);
  if (selectedItem == null) return null;

  if (annotation.listicleMarkerRange?.itemIndex === selectedItem) {
    return listicleRangeForWord(annotation, "marker", true);
  }
  if (annotation.listicleRevealRange?.itemIndex === selectedItem) {
    return listicleRangeForWord(annotation, "reveal", true);
  }

  return null;
}

/** Selected range covering this word — drives resize handles. */
export function resolveSelectedRange(
  annotation: WordAnnotation,
  selection: Selection | null,
): ActiveRange | null {
  const listicleRange = listicleSelectedRange(annotation, selection);
  if (listicleRange) return listicleRange;

  const vfx = annotation.vfxRanges?.find((r) =>
    isSelected(selection, "vfx", r.id),
  );
  if (vfx) {
    return {
      kind: "vfx",
      id: vfx.id,
      edge: vfx.edge,
      selected: true,
    };
  }

  const bRoll = annotation.bRollRanges?.find((r) =>
    isSelected(selection, "broll", r.id),
  );
  if (bRoll) {
    return {
      kind: "broll",
      id: bRoll.id,
      edge: bRoll.edge,
      selected: true,
    };
  }

  const sfx = annotation.sfxRanges?.find((r) =>
    isSelected(selection, "sfx", r.id),
  );
  if (sfx) {
    return {
      kind: "sfx",
      id: sfx.id,
      edge: sfx.edge,
      selected: true,
    };
  }

  if (
    annotation.punchInIndex != null &&
    annotation.punchInEdge &&
    isSelected(selection, "punchIn", annotation.punchInIndex)
  ) {
    return {
      kind: "zoom",
      id: annotation.punchInIndex,
      edge: annotation.punchInEdge,
      selected: true,
    };
  }

  return null;
}

export function handlesForSelectedRange(
  range: ActiveRange | null,
  onStartResize?: StartRangeResize,
): { start: HandleConfig | null; end: HandleConfig | null } {
  if (!range || !onStartResize) {
    return { start: null, end: null };
  }

  const start = isStartEdge(range.edge)
    ? {
        kind: range.kind,
        onMouseDown: (e: MouseEvent) =>
          onStartResize(e, range.kind, range.id, "start"),
      }
    : null;

  const end = isEndEdge(range.edge)
    ? {
        kind: range.kind,
        onMouseDown: (e: MouseEvent) =>
          onStartResize(e, range.kind, range.id, "end"),
      }
    : null;

  return { start, end };
}
