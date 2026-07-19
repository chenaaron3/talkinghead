import type { MouseEvent } from "react";

import { isSelected } from './selection';

import type { Selection } from "./selection";

import type { RangeEdge, WordAnnotation } from "./word-annotations";

export type RangeKind = "broll" | "sfx" | "zoom";

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

/**
 * Range covering this word for transcript tint.
 * Priority: b-roll > selected sfx > zoom.
 * B-roll/zoom always cover (prefer selected when several overlap);
 * sfx only when selected (marker-first elsewhere).
 */
export function resolveStyleRange(
  annotation: WordAnnotation,
  selection: Selection | null,
): ActiveRange | null {
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

/** Selected range covering this word — drives resize handles. */
export function resolveSelectedRange(
  annotation: WordAnnotation,
  selection: Selection | null,
): ActiveRange | null {
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
