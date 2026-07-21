import type { SourceCut } from "./config-types";
import type { KeepSegment } from "./pipeline-types";

const MIN_REGION_SEC = 0.1;

export type KeepRegion = {
  start: number;
  end: number;
};

export type TimelineRegion = KeepRegion & {
  keep: boolean;
};

/** Sort, merge overlaps, and drop zero-length cuts. */
export function normalizeCuts(cuts: SourceCut[]): SourceCut[] {
  const sorted = [...cuts]
    .filter((c) => c.end > c.start + 0.001)
    .sort((a, b) => a.start - b.start);

  const merged: SourceCut[] = [];
  for (const cut of sorted) {
    const last = merged[merged.length - 1];
    if (last && cut.start <= last.end + 0.001) {
      last.end = Math.max(last.end, cut.end);
    } else {
      merged.push({ ...cut });
    }
  }
  return merged;
}

function captionFullyInCut(
  caption: { start: number; end: number },
  cut: SourceCut,
): boolean {
  return (
    caption.start >= cut.start - 0.001 && caption.end <= cut.end + 0.001
  );
}

/** True when the caption lies entirely inside a cut (no kept audio remains). */
export function captionFullyInCuts(
  caption: { start: number; end: number },
  cuts: SourceCut[],
): boolean {
  return normalizeCuts(cuts).some((cut) => captionFullyInCut(caption, cut));
}

function hasSurvivingCaptionBetween(
  lo: number,
  hi: number,
  cuts: SourceCut[],
  captions: readonly { start: number; end: number }[],
): boolean {
  if (hi <= lo + 0.001) return false;
  return captions.some(
    (caption) =>
      caption.start < hi - 0.001 &&
      caption.end > lo + 0.001 &&
      !captionFullyInCuts(caption, cuts),
  );
}

/** Bridge adjacent cuts when only removed captions (or silence) lie between them. */
export function mergeCutsOverRemovedCaptions(
  cuts: SourceCut[],
  captions: readonly { start: number; end: number }[],
): SourceCut[] {
  const normalized = normalizeCuts(cuts);
  if (normalized.length <= 1) return normalized;

  const merged: SourceCut[] = [];
  for (const cut of normalized) {
    const last = merged[merged.length - 1];
    if (
      last &&
      !hasSurvivingCaptionBetween(last.end, cut.start, normalized, captions)
    ) {
      last.end = Math.max(last.end, cut.end);
    } else {
      merged.push({ ...cut });
    }
  }
  return merged;
}

/** Validate cuts are within source duration and non-overlapping. */
export function validateCuts(cuts: SourceCut[], durationSec: number): void {
  const normalized = normalizeCuts(cuts);
  for (let i = 0; i < normalized.length; i++) {
    const cut = normalized[i]!;
    if (cut.start < 0 || cut.end > durationSec + 0.05) {
      throw new Error(
        `config.cuts[${i}] out of range (0–${durationSec.toFixed(2)}s)`,
      );
    }
    if (cut.end <= cut.start) {
      throw new Error(`config.cuts[${i}] has end <= start`);
    }
    if (i > 0) {
      const prev = normalized[i - 1]!;
      if (cut.start < prev.end - 0.001) {
        throw new Error(`config.cuts[${i}] overlaps previous cut`);
      }
    }
  }
}

/** Derive kept source ranges by inverting cuts across full duration. */
export function cutsToKeepRegions(
  cuts: SourceCut[],
  durationSec: number,
): KeepRegion[] {
  const merged = normalizeCuts(cuts);
  const keeps: KeepRegion[] = [];
  let cursor = 0;

  for (const cut of merged) {
    if (cut.start > cursor + 0.001) {
      keeps.push({ start: cursor, end: cut.start });
    }
    cursor = Math.max(cursor, cut.end);
  }

  if (cursor < durationSec - 0.001) {
    keeps.push({ start: cursor, end: durationSec });
  }

  if (keeps.length === 0 && durationSec > 0) {
    keeps.push({ start: 0, end: durationSec });
  }

  return keeps;
}

/** Full source timeline for display: alternating keep (true) and cut (false). */
export function cutsToTimelineRegions(
  cuts: SourceCut[],
  durationSec: number,
): TimelineRegion[] {
  const keeps = cutsToKeepRegions(cuts, durationSec);
  if (keeps.length === 0) return [];

  const regions: TimelineRegion[] = [];

  if (keeps[0]!.start > 0.001) {
    regions.push({ start: 0, end: keeps[0]!.start, keep: false });
  }

  for (let i = 0; i < keeps.length; i++) {
    const keep = keeps[i]!;
    regions.push({ start: keep.start, end: keep.end, keep: true });
    const next = keeps[i + 1];
    if (next && next.start > keep.end + 0.001) {
      regions.push({ start: keep.end, end: next.start, keep: false });
    }
  }

  const last = keeps[keeps.length - 1]!;
  if (last.end < durationSec - 0.001) {
    regions.push({ start: last.end, end: durationSec, keep: false });
  }

  return regions;
}

/** Derive output keep segments from source cuts. */
export function cutsToKeepSegments(
  cuts: SourceCut[],
  fps: number,
  durationSec: number,
): KeepSegment[] {
  let outputCursor = 0;
  return cutsToKeepRegions(cuts, durationSec).map((interval) => {
    const trimBefore = Math.round(interval.start * fps);
    const trimAfter = Math.round(interval.end * fps);
    const durationInFrames = Math.max(1, trimAfter - trimBefore);
    const outputStartSec = outputCursor;
    const outputEndSec = outputCursor + durationInFrames / fps;
    outputCursor = outputEndSec;
    return {
      startSec: interval.start,
      endSec: interval.end,
      outputStartSec,
      outputEndSec,
      trimBefore,
      trimAfter,
      durationInFrames,
    };
  });
}

/** Map source seconds into edited output seconds, or null if cut. */
export function mapSourceSecToOutputSec(
  sourceSec: number,
  segments: KeepSegment[],
): number | null {
  for (const seg of segments) {
    if (sourceSec >= seg.startSec && sourceSec <= seg.endSec) {
      return seg.outputStartSec + (sourceSec - seg.startSec);
    }
  }
  return null;
}

export function mapSourceSecToOutputFrame(
  sourceSec: number,
  segments: KeepSegment[],
  fps: number,
): number | null {
  const outSec = mapSourceSecToOutputSec(sourceSec, segments);
  if (outSec == null) return null;
  return Math.max(0, Math.round(outSec * fps));
}

/** Snap a source timestamp to the nearest point inside a kept region. */
export function snapSourceSecToKeep(
  sourceSec: number,
  cuts: SourceCut[],
  durationSec: number,
): number {
  const keeps = cutsToKeepRegions(cuts, durationSec);
  for (const keep of keeps) {
    if (sourceSec >= keep.start && sourceSec <= keep.end) {
      return sourceSec;
    }
  }

  let best: { dist: number; point: number } | null = null;
  for (const keep of keeps) {
    for (const point of [keep.start, keep.end]) {
      const dist = Math.abs(point - sourceSec);
      if (!best || dist < best.dist) {
        best = { dist, point };
      }
    }
  }
  return best?.point ?? 0;
}

/** Intersect a source range with kept regions. */
export function intersectWithKeepRegions(
  start: number,
  end: number,
  cuts: SourceCut[],
  durationSec: number,
): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = [];
  for (const keep of cutsToKeepRegions(cuts, durationSec)) {
    const a = Math.max(start, keep.start);
    const b = Math.min(end, keep.end);
    if (b > a) {
      out.push({ start: a, end: b });
    } else if (end - start < 0.001 && start >= keep.start && start <= keep.end) {
      out.push({ start, end: start });
    }
  }
  return out;
}

export type SourceGap = {
  id: number;
  start: number;
  end: number;
};

export function cutsToGaps(cuts: SourceCut[]): SourceGap[] {
  return normalizeCuts(cuts).map((cut, id) => ({
    id,
    start: cut.start,
    end: cut.end,
  }));
}

function findCutByStart(
  cuts: SourceCut[],
  start: number,
): SourceCut | undefined {
  return cuts.find((cut) => Math.abs(cut.start - start) < 0.001);
}

function cutBeforeKeep(
  cuts: SourceCut[],
  keep: KeepRegion,
): SourceCut | undefined {
  const merged = normalizeCuts(cuts);
  for (let i = merged.length - 1; i >= 0; i--) {
    const ref = merged[i]!;
    if (ref.end <= keep.start + 0.001) {
      return findCutByStart(cuts, ref.start);
    }
  }
  return undefined;
}

function cutAfterKeep(
  cuts: SourceCut[],
  keep: KeepRegion,
): SourceCut | undefined {
  const ref = normalizeCuts(cuts).find(
    (cut) => cut.start >= keep.end - 0.001,
  );
  return ref ? findCutByStart(cuts, ref.start) : undefined;
}

/** Move a keep region edge to an absolute source timestamp. */
export function setKeepEdge(
  cuts: SourceCut[],
  keepRegionIndex: number,
  edge: "start" | "end",
  targetSec: number,
  durationSec: number,
): SourceCut[] {
  const keeps = cutsToKeepRegions(cuts, durationSec);
  const keep = keeps[keepRegionIndex];
  if (!keep) return cuts;

  const current = edge === "start" ? keep.start : keep.end;
  const deltaSec = targetSec - current;
  if (deltaSec === 0) return cuts;

  const next = cuts.map((c) => ({ ...c }));

  if (edge === "start") {
    const cut = cutBeforeKeep(next, keep);
    if (!cut) return cuts;
    const minEnd = cut.start + MIN_REGION_SEC;
    const maxEnd = keep.end - MIN_REGION_SEC;
    cut.end = Math.max(minEnd, Math.min(maxEnd, cut.end + deltaSec));
  } else {
    const cut = cutAfterKeep(next, keep);
    if (!cut) return cuts;
    const minStart = keep.start + MIN_REGION_SEC;
    const maxStart = cut.end - MIN_REGION_SEC;
    cut.start = Math.max(minStart, Math.min(maxStart, cut.start + deltaSec));
  }

  return normalizeCuts(next);
}

/** Restore a cut (remove it from the config). */
export function removeCut(cuts: SourceCut[], cutId: number): SourceCut[] {
  return normalizeCuts(cuts.filter((_, i) => i !== cutId));
}
