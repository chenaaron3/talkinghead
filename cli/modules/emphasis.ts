import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { buildNumberedTranscript } from '../helpers/cuts';
import { getResultsOrCached } from '../helpers/transcript-cache';

import type { CaptionEmphasis, TranscriptWord } from "../helpers/types";

const MODEL = "gpt-4.1-mini";

export const EmphasisDetectionSchema = z.object({
  words: z
    .array(
      z.object({
        wordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Index of the word in the numbered transcript"),
        kind: z
          .enum(["positive", "negative"])
          .describe(
            "positive = green (good/desired); negative = red (bad/avoid)",
          ),
        reason: z
          .string()
          .describe("Why this word is the highlight, one short sentence"),
      }),
    )
    .describe("Most significant word about every 10–15 words"),
});

export type EmphasisDetection = z.infer<typeof EmphasisDetectionSchema>;

async function callOpenAI(words: TranscriptWord[]): Promise<EmphasisDetection> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "emphasis: true requires OPENAI_API_KEY (set it in .env or the environment)",
    );
  }

  const client = new OpenAI({ apiKey });
  const numbered = buildNumberedTranscript(words);

  const completion = await client.chat.completions.parse({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You pick on-screen caption highlight words from a talking-head transcript.",
          "Cadence: about one highlight every 10–15 words. In each window, pick only the single most significant content word.",
          "kind: positive (shown green) = good/desired sentiment; negative (shown red) = bad/avoid sentiment.",
          "Never highlight function words (don't, your, the, a, to, of, and, but).",
          "Return indices into the numbered transcript.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Numbered transcript words:\n\n${numbered}`,
      },
    ],
    response_format: zodResponseFormat(
      EmphasisDetectionSchema,
      "emphasis_detection",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI emphasis detection failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

/** Detect emphasis words and return a wordIndex → kind map (or null if disabled). */
export async function buildEmphasis(options: {
  enabled: boolean;
  words: TranscriptWord[];
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<Map<number, CaptionEmphasis> | null> {
  const { enabled, words, transcriptPath, cachePath, force } = options;
  if (!enabled) return null;

  const detection = await getResultsOrCached({
    cachePath,
    transcriptPath,
    force,
    schema: EmphasisDetectionSchema,
    compute: async () => {
      console.log(`[emphasis] detecting highlight words via OpenAI (${MODEL})`);
      return callOpenAI(words);
    },
  });

  const map = new Map<number, CaptionEmphasis>();
  for (const entry of detection.words) {
    if (entry.wordIndex < 0 || entry.wordIndex >= words.length) continue;
    map.set(entry.wordIndex, entry.kind);
  }

  console.log(`[emphasis] ${map.size} highlight word(s)`);
  return map;
}
