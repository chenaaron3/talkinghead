import type { EpisodeConfig } from "@src/lib/types";
import type { FlatCaption } from "./captions";

export type RangeEdge = "start" | "end" | "middle" | "both";

export type WordAnnotation = {
  bRollId?: string;
  bRollEdge?: RangeEdge;
  /** SFX markers that start on this word. */
  sfx?: Array<{ id: string; label: string }>;
  /** SFX clips whose play range covers this word (for selected-range UI). */
  sfxRanges?: Array<{ id: string; edge: RangeEdge }>;
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

function sfxLabel(src: string): string {
  const file = src.split("/").pop() ?? src;
  return file.replace(/\.[^.]+$/, "");
}

function sfxAt(
  caption: FlatCaption,
  clips: { id: string; src: string; start: number }[],
): Array<{ id: string; label: string }> {
  return clips
    .filter((clip) => clip.start >= caption.start && clip.start < caption.end)
    .map((clip) => ({ id: clip.id, label: sfxLabel(clip.src) }));
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

    const sfx = sfxAt(caption, config.sfx ?? []);
    if (sfx.length > 0) annotation.sfx = sfx;

    const sfxRanges: Array<{ id: string; edge: RangeEdge }> = [];
    for (const clip of config.sfx ?? []) {
      const edge = rangeEdge(caption, clip.start, clip.end, captions);
      if (edge) sfxRanges.push({ id: clip.id, edge });
    }
    if (sfxRanges.length > 0) annotation.sfxRanges = sfxRanges;

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
