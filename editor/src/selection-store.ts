import { create } from "zustand";

import {
  applySelection,
  clearKind,
  isSelected,
  primaryId,
  selectOrderedRange,
  type Selection,
  type SelectionMode,
} from "./lib/selection";
import { useEditor } from "./store";

export type { Selection, SelectionKind, SelectionMode } from "./lib/selection";
export { isSelected } from "./lib/selection";

type SelectionState = {
  selection: Selection | null;
  /** Fixed end of caption range while shift-extending (text-editor anchor). */
  captionAnchor: number | null;
  /** Moving end of caption range while shift-extending (text-editor caret). */
  captionFocus: number | null;
};

type SelectionActions = {
  setSelection: (selection: Selection | null) => void;
  select: (
    kind: Selection["kind"],
    id: number | string | null,
    mode?: SelectionMode,
  ) => void;
  selectCaptionRange: (
    start: number,
    end: number,
    orderedIndices: number[],
  ) => void;
  selectCaptionExtend: (index: number, orderedIndices: number[]) => void;
  selectBRoll: (id: string | null) => void;
  selectSfx: (id: string | null) => void;
  selectPunchIn: (index: number | null) => void;
  selectListicleItem: (index: number | null) => void;
  selectGap: (gapId: number | null) => void;
  selectKeepRegion: (index: number | null) => void;
  selectCaption: (index: number | null, mode?: SelectionMode) => void;
  clearSelection: () => void;
};

function clearCaptionRangeEnds(): Pick<
  SelectionState,
  "captionAnchor" | "captionFocus"
> {
  return { captionAnchor: null, captionFocus: null };
}

export const useSelection = create<SelectionState & SelectionActions>(
  (set, get) => ({
    selection: null,
    captionAnchor: null,
    captionFocus: null,

    setSelection: (selection) =>
      set({
        selection,
        ...(selection?.kind === "caption" ? {} : clearCaptionRangeEnds()),
      }),

    select: (kind, id, mode = "replace") => {
      if (id == null) {
        set({
          selection: clearKind(get().selection, kind),
          ...(kind === "caption" ? clearCaptionRangeEnds() : {}),
        });
        return;
      }
      set({
        selection: applySelection(get().selection, kind, [id], mode),
        ...(kind === "caption" ? clearCaptionRangeEnds() : {}),
      });
    },

    selectCaptionRange: (start, end, orderedIndices) => {
      set({
        selection: selectOrderedRange("caption", start, end, orderedIndices),
        captionAnchor: start,
        captionFocus: end,
      });
    },

    selectCaptionExtend: (index, orderedIndices) => {
      const { selection, captionAnchor } = get();
      const fallback =
        selection?.kind === "caption" ? primaryId(selection) : null;
      const anchor =
        captionAnchor ??
        (typeof fallback === "number" ? fallback : index);
      set({
        selection: selectOrderedRange("caption", anchor, index, orderedIndices),
        captionAnchor: anchor,
        captionFocus: index,
      });
    },

    selectBRoll: (id) => {
      get().select("broll", id);
      if (id == null) return;
      // Seek into the clip so inspector/handles can appear (selected + in range).
      const editor = useEditor.getState();
      const clip = editor.config?.bRolls.find((c) => c.id === id);
      if (!clip) return;
      if (editor.sourceSec < clip.start || editor.sourceSec >= clip.end) {
        editor.seekSource(clip.start);
      }
    },
    selectSfx: (id) => get().select("sfx", id),
    selectPunchIn: (index) => get().select("punchIn", index),
    selectListicleItem: (index) => get().select("listicleItem", index),
    selectGap: (gapId) => get().select("gap", gapId),
    selectKeepRegion: (index) => get().select("keepRegion", index),
    selectCaption: (index, mode = "replace") => {
      if (index == null) {
        get().select("caption", null);
        return;
      }
      if (mode === "toggle") {
        const next = applySelection(get().selection, "caption", [index], mode);
        set({
          selection: next,
          ...(next?.kind === "caption" && next.ids.length > 1
            ? clearCaptionRangeEnds()
            : next?.kind === "caption"
              ? { captionAnchor: index, captionFocus: index }
              : clearCaptionRangeEnds()),
        });
        return;
      }
      set({
        selection: applySelection(get().selection, "caption", [index], mode),
        captionAnchor: index,
        captionFocus: index,
      });
    },
    clearSelection: () =>
      set({ selection: null, ...clearCaptionRangeEnds() }),
  }),
);

export function useIsSelected(
  kind: Selection["kind"],
  id: number | string,
): boolean {
  return useSelection((s) => isSelected(s.selection, kind, id));
}
