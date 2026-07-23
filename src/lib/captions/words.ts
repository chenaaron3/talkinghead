import type { CaptionWord, TranscriptCaption } from "../types";
import {
  CAPTION_GROUP_GAP_SEC,
  CAPTION_LAST_WORD_PAD_SEC,
} from "../episode/constants";

const FILLER_WORDS = [
  "um",
  "uh",
  "uhm",
  "uhh",
  "er",
  "ah",
  "hmm",
  "mm",
  "mhm",
] as const;

function normalizeToken(word: string): string {
  return word
    .toLowerCase()
    .replace(/^[^a-z0-9']+|[^a-z0-9']+$/gi, "")
    .trim();
}

export function isFiller(word: string): boolean {
  const token = normalizeToken(word);
  if (!token) return false;
  return (FILLER_WORDS as readonly string[]).includes(token);
}

function endsWithSentencePunctuation(text: string): boolean {
  return /[.?!]+$/.test(text.trim());
}

/** Strip punctuation for on-screen captions (keeps letters, numbers, apostrophes). */
export function stripPunctuationForDisplay(text: string): string {
  return text.replace(/[^\p{L}\p{N}']/gu, "");
}

/** Captions prepared for on-screen render: fillers removed. */
export function prepareRenderCaptions(
  captions: TranscriptCaption[],
): TranscriptCaption[] {
  return captions.filter((c) => !isFiller(c.text) && c.text.trim().length > 0);
}

export type CaptionWordGroup = {
  words: CaptionWord[];
  startFrame: number;
  endFrame: number;
};

/**
 * Group words for TikTok captions within sentence boundaries.
 * Batches up to captionsAtATime words per group, but never mixes two sentences
 * (e.g. [the Hat. Green] is invalid).
 */
export function groupCaptionWords(
  words: CaptionWord[],
  captionsAtATime: number,
): CaptionWordGroup[] {
  const atATime = Math.max(1, captionsAtATime);
  const groups: CaptionWordGroup[] = [];
  let batch: CaptionWord[] = [];

  const flush = () => {
    if (batch.length === 0) return;
    groups.push({
      words: batch,
      startFrame: batch[0]!.startFrame,
      endFrame: batch[batch.length - 1]!.endFrame,
    });
    batch = [];
  };

  for (const word of words) {
    batch.push(word);

    // Sentence ended — close this batch so the next word starts a new sentence.
    if (endsWithSentencePunctuation(word.text)) {
      flush();
      continue;
    }

    if (batch.length >= atATime) flush();
  }

  flush();
  return groups;
}

/**
 * Group a sequence of words that may change style mid-stream.
 * Splits into contiguous style runs, then batches each run with its own
 * `captionsAtATime` so Quote boundaries never share a group with defaults.
 */
export function groupStyledCaptionWords(
  words: Array<CaptionWord & { styleKey: string; captionsAtATime: number }>,
): Array<CaptionWordGroup & { styleKey: string }> {
  const result: Array<CaptionWordGroup & { styleKey: string }> = [];
  let run: Array<CaptionWord & { styleKey: string; captionsAtATime: number }> =
    [];

  const flushRun = () => {
    if (run.length === 0) return;
    const styleKey = run[0]!.styleKey;
    const atATime = run[0]!.captionsAtATime;
    const plain: CaptionWord[] = run.map((w) => ({
      text: w.text,
      startFrame: w.startFrame,
      endFrame: w.endFrame,
      ...(w.emphasis ? { emphasis: w.emphasis } : {}),
    }));
    for (const group of groupCaptionWords(plain, atATime)) {
      result.push({ ...group, styleKey });
    }
    run = [];
  };

  for (const word of words) {
    if (run.length > 0 && run[0]!.styleKey !== word.styleKey) {
      flushRun();
    }
    run.push(word);
  }
  flushRun();
  return result;
}

/** Extend the last word when the next group starts later. */
export function padLastWordInGroups<T extends CaptionWordGroup>(
  groups: T[],
  fps: number,
): T[] {
  const padFrames = Math.max(2, Math.round(CAPTION_LAST_WORD_PAD_SEC * fps));
  const minGap = Math.max(1, Math.round(CAPTION_GROUP_GAP_SEC * fps));

  return groups.map((group, index) => {
    const next = groups[index + 1];
    if (!next) return group;

    const last = group.words[group.words.length - 1];
    if (!last) return group;

    const maxEnd = next.startFrame - minGap;
    const paddedEnd = Math.min(last.endFrame + padFrames, maxEnd);
    if (paddedEnd <= group.endFrame) return group;

    const words = group.words.slice();
    words[words.length - 1] = { ...last, endFrame: paddedEnd };

    return { ...group, words, endFrame: paddedEnd };
  });
}
