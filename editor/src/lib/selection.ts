export type SelectionKind =
  | "caption"
  | "broll"
  | "vfx"
  | "sfx"
  | "music"
  | "punchIn"
  | "listicleItem"
  | "gap"
  | "keepRegion";

export type Selection =
  | { kind: "caption"; ids: number[] }
  | { kind: "broll"; ids: string[] }
  | { kind: "vfx"; ids: string[] }
  | { kind: "sfx"; ids: string[] }
  | { kind: "music"; ids: string[] }
  | { kind: "punchIn"; ids: number[] }
  | { kind: "listicleItem"; ids: number[] }
  | { kind: "gap"; ids: number[] }
  | { kind: "keepRegion"; ids: number[] };

export type SelectionMode = "replace" | "toggle" | "extend" | "add";

/** Kinds that support selecting more than one item at a time. */
export const MULTI_SELECT_KINDS = new Set<SelectionKind>(["caption"]);

export function isSelected(
  selection: Selection | null | undefined,
  kind: SelectionKind,
  id: number | string,
): boolean {
  if (!selection || selection.kind !== kind) return false;
  return (selection.ids as (number | string)[]).includes(id);
}

export function primaryId(
  selection: Selection | null | undefined,
): number | string | null {
  if (!selection || selection.ids.length === 0) return null;
  return selection.ids[selection.ids.length - 1]!;
}

export function applySelection(
  current: Selection | null,
  kind: SelectionKind,
  ids: readonly (number | string)[],
  mode: SelectionMode = "replace",
): Selection | null {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return current?.kind === kind ? null : current;
  }

  const multi = MULTI_SELECT_KINDS.has(kind);

  if (mode === "replace") {
    if (!multi) return { kind, ids: [unique[0]!] } as Selection;
    return { kind, ids: unique as number[] } as Selection;
  }

  if (current?.kind !== kind) {
    return { kind, ids: [unique[0]!] } as Selection;
  }

  if (mode === "toggle") {
    const next = [...current.ids] as (number | string)[];
    for (const id of unique) {
      const i = next.indexOf(id);
      if (i >= 0) next.splice(i, 1);
      else next.push(id);
    }
    if (next.length === 0) return null;
    if (!multi && next.length > 1) return { kind, ids: [next[next.length - 1]!] } as Selection;
    return { kind, ids: next } as Selection;
  }

  if (mode === "add") {
    const merged = [...new Set([...current.ids, ...unique])];
    if (!multi && merged.length > 1) return { kind, ids: [merged[merged.length - 1]!] } as Selection;
    return { kind, ids: merged } as Selection;
  }

  return current;
}

export function selectOrderedRange(
  kind: SelectionKind,
  startId: number | string,
  endId: number | string,
  orderedIds: readonly (number | string)[],
): Selection | null {
  const startIdx = orderedIds.indexOf(startId);
  const endIdx = orderedIds.indexOf(endId);
  if (startIdx < 0 || endIdx < 0) return null;
  const lo = Math.min(startIdx, endIdx);
  const hi = Math.max(startIdx, endIdx);
  const rangeIds = orderedIds.slice(lo, hi + 1);
  return applySelection(null, kind, rangeIds, "replace");
}

export function extendSelection(
  current: Selection | null,
  kind: SelectionKind,
  targetId: number | string,
  orderedIds: readonly (number | string)[],
): Selection | null {
  if (!MULTI_SELECT_KINDS.has(kind)) {
    return applySelection(null, kind, [targetId], "replace");
  }
  const anchor =
    current?.kind === kind && current.ids.length > 0
      ? current.ids[current.ids.length - 1]!
      : targetId;
  return selectOrderedRange(kind, anchor, targetId, orderedIds);
}

export function clearKind(
  selection: Selection | null,
  kind: SelectionKind,
): Selection | null {
  return selection?.kind === kind ? null : selection;
}
