import type { EpisodeConfig, Range } from "@src/lib/types";
import type { FlatCaption } from "./captions";

export type LinkedEdgeTarget =
  | { kind: "broll"; id: string }
  | { kind: "vfx"; id: string }
  | { kind: "sfx"; id: string }
  | { kind: "zoom"; id: number };

type IndexedRange = Range & LinkedEdgeTarget;

/** Caption word that owns a start edge (same rule as transcript start markers). */
export function captionForStartEdge(
  captions: FlatCaption[],
  sec: number,
): FlatCaption | undefined {
  return captions.find((c) => sec >= c.start && sec < c.end);
}

/** Caption word that owns an end edge. */
export function captionForEndEdge(
  captions: FlatCaption[],
  sec: number,
): FlatCaption | undefined {
  return captions.find((c) => sec > c.start && sec <= c.end);
}

function sameTarget(a: LinkedEdgeTarget, b: LinkedEdgeTarget): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function startOnCaption(sec: number, caption: FlatCaption): boolean {
  return sec >= caption.start && sec < caption.end;
}

function endOnCaption(sec: number, caption: FlatCaption): boolean {
  return sec > caption.start && sec <= caption.end;
}

function configRanges(config: EpisodeConfig): IndexedRange[] {
  return [
    ...config.bRolls.map(
      (c): IndexedRange => ({
        kind: "broll",
        id: c.id,
        start: c.start,
        end: c.end,
      }),
    ),
    ...(config.vfx ?? []).map(
      (c): IndexedRange => ({
        kind: "vfx",
        id: c.id,
        start: c.start,
        end: c.end,
      }),
    ),
    ...(config.sfx ?? []).map(
      (c): IndexedRange => ({
        kind: "sfx",
        id: c.id,
        start: c.start,
        end: c.end,
      }),
    ),
    ...config.punchInSegments.map(
      (c, id): IndexedRange => ({
        kind: "zoom",
        id,
        start: c.start,
        end: c.end,
      }),
    ),
  ];
}

/**
 * Other ranges whose matching edge sits on the same caption word as `exclude`.
 * Start drags link starts; end drags link ends. Listicles are excluded.
 */
export function linkedTargetsOnCaptionEdge(
  config: EpisodeConfig,
  caption: FlatCaption,
  edge: "start" | "end",
  exclude: LinkedEdgeTarget,
): LinkedEdgeTarget[] {
  const onCaption = edge === "start" ? startOnCaption : endOnCaption;
  const out: LinkedEdgeTarget[] = [];
  for (const range of configRanges(config)) {
    if (!onCaption(range[edge], caption) || sameTarget(exclude, range)) {
      continue;
    }
    const { start: _start, end: _end, ...target } = range;
    out.push(target);
  }
  return out;
}
