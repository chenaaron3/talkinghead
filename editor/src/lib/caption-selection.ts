import { isSelected, type Selection } from "./selection";

import type { Transcript } from "@src/lib/types";

export type CaptionTimeRange = {
  start: number;
  end: number;
  firstIndex: number;
  lastIndex: number;
};

export function selectedCaptionTimeRange(
  transcript: Transcript,
  selection: Selection | null,
): CaptionTimeRange | null {
  if (selection?.kind !== "caption" || selection.ids.length === 0) return null;

  const indices = selection.ids.filter(
    (id): id is number => typeof id === "number",
  );
  if (indices.length === 0) return null;

  const firstIndex = Math.min(...indices);
  const lastIndex = Math.max(...indices);
  const first = transcript.captions[firstIndex];
  const last = transcript.captions[lastIndex];
  if (!first || !last) return null;

  return {
    start: first.start,
    end: last.end,
    firstIndex,
    lastIndex,
  };
}

/** Range for cut/zoom: full selection if caption is in it, else that caption alone. */
export function captionActionRange(
  transcript: Transcript,
  selection: Selection | null,
  caption: { index: number; start: number; end: number },
): CaptionTimeRange {
  if (
    selection?.kind === "caption" &&
    isSelected(selection, "caption", caption.index)
  ) {
    const range = selectedCaptionTimeRange(transcript, selection);
    if (range) return range;
  }
  return {
    start: caption.start,
    end: caption.end,
    firstIndex: caption.index,
    lastIndex: caption.index,
  };
}
