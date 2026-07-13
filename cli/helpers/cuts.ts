import { normalizeCuts } from "../../src/lib/source-timeline";
import {
  FILLER_PADDING_SEC,
  FILLER_WORDS,
  GAP_THRESHOLD_SEC,
  TRANSCRIPTION_ARTIFACTS,
} from "./constants";
import type { SourceCut, TranscriptCaption } from "./types";

/** Numbered caption list for OpenAI prompts that return word indices. */
export function buildNumberedTranscript(captions: TranscriptCaption[]): string {
  return captions.map((c, i) => `${i}: ${c.text}`).join("\n");
}

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

function isTranscriptionArtifact(word: string): boolean {
  const token = normalizeToken(word);
  if (!token) return /BLANK_AUDIO/i.test(word);
  return (TRANSCRIPTION_ARTIFACTS as readonly string[]).includes(token);
}

export function isSkippedWord(word: string): boolean {
  return isFiller(word) || isTranscriptionArtifact(word);
}

/** Strip punctuation for on-screen captions (keep letters/numbers/apostrophes). */
export function captionText(word: string): string {
  return word.replace(/[^\p{L}\p{N}']+/gu, "").trim();
}

/** Drop fillers/artifacts and normalize on-screen text from whisper output. */
export function filterCaptions(captions: TranscriptCaption[]): TranscriptCaption[] {
  const filtered: TranscriptCaption[] = [];
  for (const caption of captions) {
    if (isSkippedWord(caption.text)) continue;
    const text = captionText(caption.text);
    if (!text) continue;
    filtered.push({
      text,
      start: caption.start,
      end: Math.max(caption.end, caption.start + 0.04),
    });
  }
  return filtered;
}

/**
 * Auto-detect cuts from transcript captions:
 * - drop filler words (with small padding so consonants aren't clipped)
 * - collapse gaps longer than GAP_THRESHOLD_SEC between speech
 */
export function buildCutsFromWords(options: {
  captions: TranscriptCaption[];
  durationSec: number;
  fps: number;
}): SourceCut[] {
  const { captions, durationSec, fps } = options;

  type Interval = { start: number; end: number };
  const remove: Interval[] = [];

  for (const caption of captions) {
    if (!isFiller(caption.text)) continue;
    remove.push({
      start: Math.max(0, caption.start - FILLER_PADDING_SEC),
      end: Math.min(durationSec, caption.end + FILLER_PADDING_SEC),
    });
  }

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

  const keepWords = captions.filter((c) => !isSkippedWord(c.text));
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

  speechKeep.sort((a, b) => a.start - b.start);

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

  return normalizeCuts(keepsToCuts(mergedKeep, durationSec));
}

function keepsToCuts(keeps: Array<{ start: number; end: number }>, durationSec: number): SourceCut[] {
  const cuts: SourceCut[] = [];
  const first = keeps[0];
  if (first && first.start > 0.001) {
    cuts.push({ start: 0, end: first.start });
  }

  for (let i = 0; i < keeps.length - 1; i++) {
    const a = keeps[i]!;
    const b = keeps[i + 1]!;
    if (b.start > a.end + 0.001) {
      cuts.push({ start: a.end, end: b.start });
    }
  }

  const last = keeps[keeps.length - 1];
  if (last && last.end < durationSec - 0.001) {
    cuts.push({ start: last.end, end: durationSec });
  }

  return cuts;
}

/** Map a caption index to source seconds. */
export function captionIndexToSourceSec(
  index: number,
  captions: TranscriptCaption[],
  prefer: "start" | "end",
): number | null {
  if (index < 0 || index >= captions.length) return null;
  const cap = captions[index]!;
  return prefer === "start" ? cap.start : cap.end;
}
