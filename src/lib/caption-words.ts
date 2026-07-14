import type { CaptionWord, TranscriptCaption } from "./types";
import {
  CAPTION_GROUP_GAP_SEC,
  CAPTION_LAST_WORD_PAD_SEC,
} from "./constants";

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

/**
 * Group words for TikTok captions within sentence boundaries.
 * Batches up to captionsAtATime words per group, but never mixes two sentences
 * (e.g. [the Hat. Green] is invalid).
 */
export function groupCaptionWords(
  words: CaptionWord[],
  captionsAtATime: number,
): Array<{ words: CaptionWord[]; startFrame: number; endFrame: number }> {
  const atATime = Math.max(1, captionsAtATime);
  const groups: Array<{
    words: CaptionWord[];
    startFrame: number;
    endFrame: number;
  }> = [];
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

type CaptionWordGroup = {
  words: CaptionWord[];
  startFrame: number;
  endFrame: number;
};

/** Extend the last word when the next group starts later. */
export function padLastWordInGroups(
  groups: CaptionWordGroup[],
  fps: number,
): CaptionWordGroup[] {
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
