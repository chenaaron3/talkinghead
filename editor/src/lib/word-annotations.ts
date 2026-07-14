import type { EpisodeConfig } from "@src/lib/types";
import type { FlatCaption } from "./captions";

export type RangeEdge = "start" | "end" | "middle" | "both";

export type WordAnnotation = {
  bRollId?: string;
  bRollEdge?: RangeEdge;
  punchInIndex?: number;
  punchInEdge?: RangeEdge;
  listicleNumber?: number;
  listicleItemIndex?: number;
  listicleLabel?: string;
};

function rangeEdge(
  caption: FlatCaption,
  rangeStart: number,
  rangeEnd: number,
  captions: FlatCaption[],
): RangeEdge | undefined {
  if (!(caption.start < rangeEnd && caption.end > rangeStart)) return undefined;
  const overlapping = captions.filter(
    (c) => c.start < rangeEnd && c.end > rangeStart,
  );
  if (overlapping.length === 0) return undefined;
  const first = overlapping[0]!;
  const last = overlapping[overlapping.length - 1]!;
  if (first.index === last.index && caption.index === first.index) return "both";
  if (caption.index === first.index) return "start";
  if (caption.index === last.index) return "end";
  return "middle";
}

function listicleItemAt(
  caption: FlatCaption,
  items: { label: string; reveal: number }[],
): { index: number; number: number; label: string } | undefined {
  for (let i = 0; i < items.length; i++) {
    const reveal = items[i]!.reveal;
    if (reveal >= caption.start && reveal < caption.end) {
      return { index: i, number: i + 1, label: items[i]!.label };
    }
  }
  return undefined;
}

export function buildWordAnnotations(
  captions: FlatCaption[],
  config: EpisodeConfig | null,
): Map<number, WordAnnotation> {
  const out = new Map<number, WordAnnotation>();
  if (!config) return out;

  const listicleItems = config.listicleOverlay?.items ?? [];

  for (const caption of captions) {
    const annotation: WordAnnotation = {};

    for (const clip of config.bRolls) {
      const edge = rangeEdge(caption, clip.start, clip.end, captions);
      if (edge) {
        annotation.bRollId = clip.id;
        annotation.bRollEdge = edge;
        break;
      }
    }

    for (let i = 0; i < config.punchInSegments.length; i++) {
      const punchIn = config.punchInSegments[i]!;
      const edge = rangeEdge(caption, punchIn.start, punchIn.end, captions);
      if (edge) {
        annotation.punchInIndex = i;
        annotation.punchInEdge = edge;
        break;
      }
    }

    const listicleItem = listicleItemAt(caption, listicleItems);
    if (listicleItem) {
      annotation.listicleNumber = listicleItem.number;
      annotation.listicleItemIndex = listicleItem.index;
      annotation.listicleLabel = listicleItem.label;
    }

    if (Object.keys(annotation).length > 0) {
      out.set(caption.index, annotation);
    }
  }

  return out;
}
