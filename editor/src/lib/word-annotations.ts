import type { EpisodeConfig, SourceVfx, VfxType } from "@src/lib/types";
import { findIntroTextVfx } from "@src/lib/episode/text-vfx";
import { listicleItemLabel, resolveListicleItems } from "./listicle";
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
  /** Listicle marker text range (shown when item selected). */
  listicleMarkerRange?: { id: string; itemIndex: number; edge: RangeEdge };
  /** Listicle reveal text range (shown when item selected). */
  listicleRevealRange?: { id: string; itemIndex: number; edge: RangeEdge };
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

function listicleMarkerAt(
  caption: FlatCaption,
  config: EpisodeConfig,
): { index: number; number: number; label: string } | undefined {
  for (const { item, index, marker } of resolveListicleItems(config)) {
    if (marker.start >= caption.start && marker.start < caption.end) {
      return {
        index,
        number: index + 1,
        label: listicleItemLabel(config, item),
      };
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
  vfx: SourceVfx[],
  out: Map<number, WordAnnotation>,
): void {
  if (captions.length === 0) return;
  const firstWordStart = captions[0]!.start;
  const intro = findIntroTextVfx(vfx, firstWordStart);
  if (!intro) return;
  const first = captions[0]!;
  const existing = out.get(first.index) ?? {};
  const markers = existing.vfxMarkers ?? [];
  if (markers.some((m) => m.id === intro.id)) return;
  out.set(first.index, {
    ...existing,
    vfxMarkers: [
      ...markers,
      { id: intro.id, label: vfxClipLabel(intro), type: intro.type },
    ],
  });
}

export function buildWordAnnotations(
  captions: FlatCaption[],
  config: EpisodeConfig | null,
): Map<number, WordAnnotation> {
  const out = new Map<number, WordAnnotation>();
  if (!config) return out;

  const listicleItems = resolveListicleItems(config);

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
      if (clip.type === "listicle-text") continue;
      const edge = rangeEdge(caption, clip.start, clip.end, captions);
      if (edge) vfxRanges.push({ id: clip.id, edge });
    }
    if (vfxRanges.length > 0) annotation.vfxRanges = vfxRanges;

    const vfxMarkers = vfxMarkersAt(
      caption,
      (config.vfx ?? []).filter((clip) => clip.type !== "listicle-text"),
    );
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

    const listicleItem = listicleMarkerAt(caption, config);
    if (listicleItem) {
      annotation.listicleNumber = listicleItem.number;
      annotation.listicleItemIndex = listicleItem.index;
      annotation.listicleLabel = listicleItem.label;
    }

    for (const { index, marker, reveal } of listicleItems) {
      const markerEdge = rangeEdge(
        caption,
        marker.start,
        marker.end,
        captions,
      );
      if (markerEdge) {
        annotation.listicleMarkerRange = {
          id: marker.id,
          itemIndex: index,
          edge: markerEdge,
        };
      }
      const revealEdge = rangeEdge(
        caption,
        reveal.start,
        reveal.end,
        captions,
      );
      if (revealEdge) {
        annotation.listicleRevealRange = {
          id: reveal.id,
          itemIndex: index,
          edge: revealEdge,
        };
      }
    }

    if (Object.keys(annotation).length > 0) {
      out.set(caption.index, annotation);
    }
  }

  attachIntroTextMarker(captions, config.vfx ?? [], out);

  return out;
}

function punchInMarkersAt(
  caption: FlatCaption,
  segments: { start: number }[],
): Array<{ index: number }> {
  const markers: Array<{ index: number }> = [];
  for (let i = 0; i < segments.length; i++) {
    const start = segments[i]!.start;
    if (start >= caption.start && start < caption.end) {
      markers.push({ index: i });
    }
  }
  return markers;
}
