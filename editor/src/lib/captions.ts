import {
  FILLER_WORDS,
  TRANSCRIPTION_ARTIFACTS,
} from "../../../cli/helpers/constants";
import type {
  CaptionEmphasis,
  CaptionGroup,
  CaptionWord,
  EpisodeProps,
  TranscriptWord,
} from "@src/lib/types";
import { outputToSourceFrame, type Section } from "./frames";

export type FlatWord = CaptionWord & {
  groupIndex: number;
  wordIndex: number;
  flatIndex: number;
};

export function flattenWords(groups: CaptionGroup[]): FlatWord[] {
  const out: FlatWord[] = [];
  let flatIndex = 0;
  groups.forEach((group, groupIndex) => {
    group.words.forEach((word, wordIndex) => {
      out.push({ ...word, groupIndex, wordIndex, flatIndex });
      flatIndex += 1;
    });
  });
  return out;
}

export function updateCaptionWord(
  props: EpisodeProps,
  groupIndex: number,
  wordIndex: number,
  patch: Partial<CaptionWord> & { clearEmphasis?: boolean },
): EpisodeProps {
  const captionGroups = props.captionGroups.map((group, gi) => {
    if (gi !== groupIndex) return group;
    const words = group.words.map((word, wi) => {
      if (wi !== wordIndex) return word;
      const next: CaptionWord = { ...word, ...patch };
      delete (next as { clearEmphasis?: boolean }).clearEmphasis;
      if (patch.clearEmphasis) {
        delete next.emphasis;
      }
      return next;
    });
    return {
      words,
      startFrame: words[0]?.startFrame ?? group.startFrame,
      endFrame: words[words.length - 1]?.endFrame ?? group.endFrame,
    };
  });
  return { ...props, captionGroups };
}

// --- Word filtering (mirrors cli/helpers/cuts.ts) ---

function normalizeToken(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "")
    .trim();
}

function isSkippedWord(word: string): boolean {
  const token = normalizeToken(word);
  if (!token) return /BLANK_AUDIO/i.test(word);
  return (
    (FILLER_WORDS as readonly string[]).includes(token) ||
    (TRANSCRIPTION_ARTIFACTS as readonly string[]).includes(token)
  );
}

/** Strip punctuation for on-screen captions (keep letters/numbers/apostrophes). */
function captionText(word: string): string {
  return word.replace(/[^\p{L}\p{N}']+/gu, "").trim();
}

// --- Rebuilding captions from the transcript ---

/** Map a source timestamp (seconds) into the output timeline, or null if cut. */
function mapSourceSecToOutputSec(
  sourceSec: number,
  sections: Section[],
  fps: number,
): number | null {
  let outputCursor = 0;
  for (const s of sections) {
    const startSec = s.trimBefore / fps;
    const endSec = s.trimAfter / fps;
    if (sourceSec >= startSec && sourceSec <= endSec) {
      return outputCursor + (sourceSec - startSec);
    }
    outputCursor += s.durationInFrames / fps;
  }
  return null;
}

type TimedWord = CaptionWord & {
  /** Position of the word in the source video, used as its stable identity. */
  sourceFrame: number;
};

/** Captionable transcript words that survive the current cuts, with output timings. */
function buildTimedWords(
  sections: Section[],
  fps: number,
  transcriptWords: TranscriptWord[],
): TimedWord[] {
  const timed: TimedWord[] = [];
  for (const tw of transcriptWords) {
    if (isSkippedWord(tw.word)) continue;
    const text = captionText(tw.word);
    if (!text) continue;
    const outStart = mapSourceSecToOutputSec(tw.start, sections, fps);
    const outEnd = mapSourceSecToOutputSec(tw.end, sections, fps);
    if (outStart == null || outEnd == null) continue;
    const startFrame = Math.max(0, Math.round(outStart * fps));
    const rawEnd = Math.round(Math.max(outEnd, outStart + 1 / fps) * fps);
    timed.push({
      sourceFrame: Math.round(tw.start * fps),
      text,
      startSec: outStart,
      endSec: Math.max(outEnd, outStart + 1 / fps),
      startFrame,
      endFrame: Math.max(startFrame + 3, rawEnd),
    });
  }
  return timed;
}

function groupCaptionWords(
  words: CaptionWord[],
  captionsAtATime: number,
): CaptionGroup[] {
  const atATime = Math.max(1, captionsAtATime);
  const groups: CaptionGroup[] = [];
  for (let i = 0; i < words.length; i += atATime) {
    const slice = words.slice(i, i + atATime);
    groups.push({
      words: slice,
      startFrame: slice[0]!.startFrame,
      endFrame: slice[slice.length - 1]!.endFrame,
    });
  }
  return groups;
}

/**
 * Rebuild captions from Whisper source times + current cuts. The transcript is
 * the source of truth for which words exist and when; edited text/emphasis is
 * carried over by locating each old word in the source video via `oldSections`
 * (never by array index — index pairing desyncs everything after a restored or
 * dropped word).
 */
export function rebuildCaptions(
  props: EpisodeProps,
  transcriptWords: TranscriptWord[],
  oldSections: Section[],
): EpisodeProps {
  const timed = buildTimedWords(props.sections, props.fps, transcriptWords);
  if (timed.length === 0) return props;

  const edits = new Map<number, { text: string; emphasis?: CaptionEmphasis }>();
  const bySourceFrame = new Map<number, number>();
  timed.forEach((t, i) => bySourceFrame.set(t.sourceFrame, i));
  for (const w of flattenWords(props.captionGroups)) {
    const src = outputToSourceFrame(w.startFrame, oldSections);
    if (src == null) continue;
    // Exact in the common case; ±2 frames absorbs rounding at section edges.
    for (const candidate of [src, src - 1, src + 1, src - 2, src + 2]) {
      const idx = bySourceFrame.get(candidate);
      if (idx != null && !edits.has(idx)) {
        edits.set(idx, { text: w.text, emphasis: w.emphasis });
        break;
      }
    }
  }

  const words = timed.map(
    (t, i): CaptionWord => ({
      text: edits.get(i)?.text ?? t.text,
      startSec: t.startSec,
      endSec: t.endSec,
      startFrame: t.startFrame,
      endFrame: t.endFrame,
      ...(edits.get(i)?.emphasis ? { emphasis: edits.get(i)!.emphasis } : {}),
    }),
  );

  return {
    ...props,
    captionGroups: groupCaptionWords(words, props.captionsAtATime),
  };
}
