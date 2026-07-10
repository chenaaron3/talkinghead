import {
  FILLER_PADDING_SEC,
  FILLER_WORDS,
  GAP_THRESHOLD_SEC,
} from "./constants";
import type {
  CaptionGroup,
  CaptionWord,
  KeepSegment,
  TranscriptWord,
} from "./types";

function normalizeToken(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "")
    .trim();
}

function isFiller(word: string): boolean {
  const token = normalizeToken(word);
  if (!token) return false;
  return (FILLER_WORDS as readonly string[]).includes(token);
}

/** Strip punctuation for on-screen captions (keep letters/numbers/apostrophes). */
function captionText(word: string): string {
  return word.replace(/[^\p{L}\p{N}']+/gu, "").trim();
}

/**
 * Build keep-segments from word timestamps:
 * - drop filler words (with small padding so consonants aren't clipped)
 * - collapse gaps longer than GAP_THRESHOLD_SEC between keep regions
 */
export function buildKeepSegments(options: {
  words: TranscriptWord[];
  durationSec: number;
  fps: number;
}): KeepSegment[] {
  const { words, durationSec, fps } = options;

  type Interval = { start: number; end: number };
  const remove: Interval[] = [];

  for (const word of words) {
    if (!isFiller(word.word)) continue;
    remove.push({
      start: Math.max(0, word.start - FILLER_PADDING_SEC),
      end: Math.min(durationSec, word.end + FILLER_PADDING_SEC),
    });
  }

  // Merge overlapping remove intervals
  remove.sort((a, b) => a.start - b.start);
  const mergedRemove: Interval[] = [];
  for (const interval of remove) {
    const last = mergedRemove[mergedRemove.length - 1];
    if (!last || interval.start > last.end) {
      mergedRemove.push({ ...interval });
    } else {
      last.end = Math.max(last.end, interval.end);
    }
  }

  // Invert remove intervals → keep intervals across full duration
  let cursor = 0;
  const keepRaw: Interval[] = [];
  for (const gap of mergedRemove) {
    if (gap.start > cursor) {
      keepRaw.push({ start: cursor, end: gap.start });
    }
    cursor = Math.max(cursor, gap.end);
  }
  if (cursor < durationSec) {
    keepRaw.push({ start: cursor, end: durationSec });
  }
  if (keepRaw.length === 0) {
    keepRaw.push({ start: 0, end: durationSec });
  }

  // Split keep intervals on long internal silence using word boundaries.
  const keepWords = words.filter((w) => !isFiller(w.word));
  const speechKeep: Interval[] = [];

  for (const region of keepRaw) {
    const inRegion = keepWords.filter(
      (w) => w.end > region.start && w.start < region.end,
    );

    if (inRegion.length === 0) {
      if (region.end - region.start <= GAP_THRESHOLD_SEC) {
        speechKeep.push(region);
      }
      continue;
    }

    const first = inRegion[0]!;
    let segStart = Math.max(region.start, first.start);
    segStart = Math.max(region.start, segStart - FILLER_PADDING_SEC);

    for (let i = 0; i < inRegion.length; i++) {
      const word = inRegion[i]!;
      const next = inRegion[i + 1];

      if (!next) {
        const segEnd = Math.min(region.end, word.end + FILLER_PADDING_SEC);
        if (segEnd > segStart) {
          speechKeep.push({ start: segStart, end: segEnd });
        }
        break;
      }

      const gap = next.start - word.end;
      if (gap > GAP_THRESHOLD_SEC) {
        const segEnd = Math.min(region.end, word.end + FILLER_PADDING_SEC);
        if (segEnd > segStart) {
          speechKeep.push({ start: segStart, end: segEnd });
        }
        segStart = Math.max(region.start, next.start - FILLER_PADDING_SEC);
      }
    }
  }

  const mergedKeep: Interval[] = [];
  for (const interval of speechKeep) {
    if (interval.end - interval.start < 1 / fps) continue;
    const last = mergedKeep[mergedKeep.length - 1];
    if (last && interval.start <= last.end + 1 / fps) {
      last.end = Math.max(last.end, interval.end);
    } else {
      mergedKeep.push({ ...interval });
    }
  }

  if (mergedKeep.length === 0) {
    mergedKeep.push({ start: 0, end: durationSec });
  }

  let outputCursor = 0;
  return mergedKeep.map((interval) => {
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

/** Map a source timestamp into the edited output timeline, or null if cut. */
export function mapSourceTimeToOutput(
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

export function buildCaptionGroups(options: {
  words: TranscriptWord[];
  segments: KeepSegment[];
  fps: number;
  captionsAtATime: number;
}): CaptionGroup[] {
  const { words, segments, fps, captionsAtATime } = options;

  const captionWords: CaptionWord[] = [];
  for (const word of words) {
    if (isFiller(word.word)) continue;

    const outStart = mapSourceTimeToOutput(word.start, segments);
    const outEnd = mapSourceTimeToOutput(word.end, segments);
    if (outStart == null || outEnd == null) continue;

    const startFrame = Math.max(0, Math.round(outStart * fps));
    const rawEnd = Math.round(Math.max(outEnd, outStart + 1 / fps) * fps);
    const endFrame = Math.max(startFrame + 3, rawEnd);

    const text = captionText(word.word);
    if (!text) continue;

    captionWords.push({
      text,
      startSec: outStart,
      endSec: Math.max(outEnd, outStart + 1 / fps),
      startFrame,
      endFrame,
    });
  }

  const groups: CaptionGroup[] = [];
  for (let i = 0; i < captionWords.length; i += captionsAtATime) {
    const slice = captionWords.slice(i, i + captionsAtATime);
    if (slice.length === 0) continue;
    groups.push({
      words: slice,
      startFrame: slice[0]!.startFrame,
      endFrame: slice[slice.length - 1]!.endFrame,
    });
  }

  return groups;
}
