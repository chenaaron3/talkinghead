import type { EpisodeConfig, SourceVfx, VfxType } from "@src/lib/types";
import { findIntroTextVfx } from "@src/lib/episode/text-vfx";
import type { FlatCaption } from "./captions";
import { vfxClipLabel } from "./vfx";

export type RangeEdge = "start" | "end" | "middle" | "both";

export type WordAnnotation = {
  /** B-roll clips whose play range covers this word. */
  bRollRanges?: Array<{ id: string; edge: RangeEdge }>;
  /** B-roll markers that start on this word. */
  bRollMarkers?: Array<{ id: string; src: string }>;
  /** VFX clips whose play range covers this word. */
  vfxRanges?: Array<{ id: string; edge: RangeEdge }>;
  /** VFX markers that start on this word. */
  vfxMarkers?: Array<{
    id: string;
    label: string;
    type: VfxType;
  }>;
  /** SFX markers that start on this word. */
  sfx?: Array<{ id: string; label: string }>;
  /** SFX clips whose play range covers this word (for selected-range UI). */
  sfxRanges?: Array<{ id: string; edge: RangeEdge }>;
  punchInIndex?: number;
  punchInEdge?: RangeEdge;
  /** Punch-in markers that start on this word. */
  punchInMarkers?: Array<{ index: number }>;
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

function bRollMarkersAt(
  caption: FlatCaption,
  clips: { id: string; src: string; start: number }[],
): Array<{ id: string; src: string }> {
  return clips
    .filter((clip) => clip.start >= caption.start && clip.start < caption.end)
    .map((clip) => ({ id: clip.id, src: clip.src }));
}

function vfxMarkersAt(
  caption: FlatCaption,
  clips: SourceVfx[],
): Array<{ id: string; label: string; type: VfxType }> {
  return clips
    .filter((clip) => clip.start >= caption.start && clip.start < caption.end)
    .map((clip) => ({
      id: clip.id,
      type: clip.type,
      label: vfxClipLabel(clip),
    }));
}

/**
 * Intro text VFX starts before speech — pin its marker onto the first caption.
 */
function attachIntroTextMarker(
  captions: FlatCaption[],
  clips: SourceVfx[],
  out: Map<number, WordAnnotation>,
): void {
  if (captions.length === 0) return;
  const clip = findIntroTextVfx(clips, captions[0]!.start);
  if (!clip) return;

  const target = captions[0]!;
  const annotation = out.get(target.index) ?? {};
  const markers = annotation.vfxMarkers ?? [];
  if (!markers.some((m) => m.id === clip.id)) {
    markers.push({
      id: clip.id,
      type: clip.type,
      label: vfxClipLabel(clip),
    });
    annotation.vfxMarkers = markers;
  }
  // Short intro that ends before speech: still show a range chip on word 0.
  const overlaps = captions.some(
    (c) => c.start < clip.end && c.end > clip.start,
  );
  if (!overlaps) {
    const ranges = annotation.vfxRanges ?? [];
    if (!ranges.some((r) => r.id === clip.id)) {
      ranges.push({ id: clip.id, edge: "both" });
      annotation.vfxRanges = ranges;
    }
  }
  out.set(target.index, annotation);
}

function punchInMarkersAt(
  caption: FlatCaption,
  segments: { start: number }[],
): Array<{ index: number }> {
  const out: Array<{ index: number }> = [];
  for (let i = 0; i < segments.length; i++) {
    const start = segments[i]!.start;
    if (start >= caption.start && start < caption.end) {
      out.push({ index: i });
    }
  }
  return out;
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

    const bRollRanges: Array<{ id: string; edge: RangeEdge }> = [];
    for (const clip of config.bRolls) {
      const edge = rangeEdge(caption, clip.start, clip.end, captions);
      if (edge) bRollRanges.push({ id: clip.id, edge });
    }
    if (bRollRanges.length > 0) annotation.bRollRanges = bRollRanges;

    const bRollMarkers = bRollMarkersAt(caption, config.bRolls);
    if (bRollMarkers.length > 0) annotation.bRollMarkers = bRollMarkers;

    const vfxRanges: Array<{ id: string; edge: RangeEdge }> = [];
    for (const clip of config.vfx ?? []) {
      const edge = rangeEdge(caption, clip.start, clip.end, captions);
      if (edge) vfxRanges.push({ id: clip.id, edge });
    }
    if (vfxRanges.length > 0) annotation.vfxRanges = vfxRanges;

    const vfxMarkers = vfxMarkersAt(caption, config.vfx ?? []);
    if (vfxMarkers.length > 0) annotation.vfxMarkers = vfxMarkers;

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

    const punchInMarkers = punchInMarkersAt(
      caption,
      config.punchInSegments,
    );
    if (punchInMarkers.length > 0) annotation.punchInMarkers = punchInMarkers;

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

  attachIntroTextMarker(captions, config.vfx ?? [], out);

  return out;
}
