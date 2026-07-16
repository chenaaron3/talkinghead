import {
  PROCESS_GAP_THRESHOLD_SEC,
  SCISSOR_GAP_THRESHOLD_SEC,
  SCISSOR_MARGIN_SEC,
} from "./editing-constants";
import { normalizeCuts } from "./source-timeline";
import type { SourceCut, TranscriptCaption } from "./types";

export type InterWordPause = {
  key: string;
  kind: "inter" | "leading" | "trailing";
  /** Caption index this ghost appears immediately before (inter-word only). */
  beforeCaptionIndex: number | null;
  cutStart: number;
  cutEnd: number;
  removedSec: number;
  rawGapSec: number;
  /** Raw pause exceeds process auto-cut threshold. */
  isProcessLevel: boolean;
};

function captionOverlapsCut(
  caption: { start: number; end: number },
  cuts: SourceCut[],
): boolean {
  return normalizeCuts(cuts).some(
    (cut) => caption.start < cut.end && caption.end > cut.start,
  );
}

function intervalHasCut(
  start: number,
  end: number,
  cuts: SourceCut[],
): boolean {
  return normalizeCuts(cuts).some((cut) => cut.start < end && cut.end > start);
}

function visibleCaptions(
  captions: readonly TranscriptCaption[],
  cuts: SourceCut[],
): Array<TranscriptCaption & { index: number }> {
  return captions
    .map((caption, index) => ({ ...caption, index }))
    .filter((caption) => !captionOverlapsCut(caption, cuts));
}

function buildPause(options: {
  key: string;
  kind: InterWordPause["kind"];
  beforeCaptionIndex: number | null;
  rawStart: number;
  rawEnd: number;
  cutStart: number;
  cutEnd: number;
  cuts: SourceCut[];
  threshold: number;
}): InterWordPause | null {
  const rawGapSec = options.rawEnd - options.rawStart;
  if (rawGapSec <= options.threshold) return null;
  if (intervalHasCut(options.rawStart, options.rawEnd, options.cuts)) {
    return null;
  }
  const removedSec = options.cutEnd - options.cutStart;
  if (removedSec <= 0.001) return null;

  return {
    key: options.key,
    kind: options.kind,
    beforeCaptionIndex: options.beforeCaptionIndex,
    cutStart: options.cutStart,
    cutEnd: options.cutEnd,
    removedSec,
    rawGapSec,
    isProcessLevel: rawGapSec > PROCESS_GAP_THRESHOLD_SEC,
  };
}

/** Pauses between visible transcript words that scissor mode can cut. */
export function findScissorPauses(options: {
  captions: readonly TranscriptCaption[];
  cuts: SourceCut[];
  durationSec: number;
  threshold?: number;
  margin?: number;
}): InterWordPause[] {
  const {
    captions,
    cuts,
    durationSec,
    threshold = SCISSOR_GAP_THRESHOLD_SEC,
    margin = SCISSOR_MARGIN_SEC,
  } = options;

  const visible = visibleCaptions(captions, cuts);
  const pauses: InterWordPause[] = [];

  if (visible.length === 0) return pauses;

  const leading = buildPause({
    key: "leading",
    kind: "leading",
    beforeCaptionIndex: visible[0]!.index,
    rawStart: 0,
    rawEnd: visible[0]!.start,
    cutStart: 0,
    cutEnd: visible[0]!.start - margin,
    cuts,
    threshold,
  });
  if (leading) pauses.push(leading);

  for (let i = 0; i < visible.length - 1; i++) {
    const prev = visible[i]!;
    const next = visible[i + 1]!;
    const pause = buildPause({
      key: `inter-${prev.index}-${next.index}`,
      kind: "inter",
      beforeCaptionIndex: next.index,
      rawStart: prev.end,
      rawEnd: next.start,
      cutStart: prev.end + margin,
      cutEnd: next.start - margin,
      cuts,
      threshold,
    });
    if (pause) pauses.push(pause);
  }

  const last = visible[visible.length - 1]!;
  const trailing = buildPause({
    key: "trailing",
    kind: "trailing",
    beforeCaptionIndex: null,
    rawStart: last.end,
    rawEnd: durationSec,
    cutStart: last.end + margin,
    cutEnd: durationSec,
    cuts,
    threshold,
  });
  if (trailing) pauses.push(trailing);

  return pauses;
}
