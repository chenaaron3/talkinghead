import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { buildNumberedTranscript } from "../helpers/cuts";
import { getResultsOrCached } from "../helpers/transcript-cache";
import type { CaptionEmphasis, TranscriptCaption } from "../helpers/types";

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

async function callOpenAI(captions: TranscriptCaption[]): Promise<EmphasisDetection> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "emphasis: true requires OPENAI_API_KEY (set it in .env or the environment)",
    );
  }

  const client = new OpenAI({ apiKey });
  const numbered = buildNumberedTranscript(captions);

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

export async function detectEmphasis(options: {
  captions: TranscriptCaption[];
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<EmphasisDetection> {
  const { captions, transcriptPath, cachePath, force } = options;

  return getResultsOrCached({
    cachePath,
    transcriptPath,
    force,
    schema: EmphasisDetectionSchema,
    compute: async () => {
      console.log(`[emphasis] detecting highlight words via OpenAI (${MODEL})`);
      return callOpenAI(captions);
    },
  });
}

/** Apply emphasis detection onto flat captions. */
export function applyEmphasisToCaptions(
  captions: TranscriptCaption[],
  detection: EmphasisDetection,
): TranscriptCaption[] {
  const emphasisByIndex = new Map<number, CaptionEmphasis>();
  for (const entry of detection.words) {
    if (entry.wordIndex < 0 || entry.wordIndex >= captions.length) continue;
    emphasisByIndex.set(entry.wordIndex, entry.kind);
  }
  return captions.map((cap, i) => {
    const emphasis = emphasisByIndex.get(i);
    if (!emphasis) return cap;
    return { ...cap, emphasis };
  });
}

/** Detect emphasis and merge onto captions (or return unchanged if disabled). */
export async function buildEmphasisCaptions(options: {
  enabled: boolean;
  captions: TranscriptCaption[];
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<TranscriptCaption[]> {
  const { enabled, captions, transcriptPath, cachePath, force } = options;
  if (!enabled) return captions;

  const detection = await detectEmphasis({
    captions,
    transcriptPath,
    cachePath,
    force,
  });

  const next = applyEmphasisToCaptions(captions, detection);
  console.log(
    `[emphasis] ${detection.words.length} highlight word(s) merged into transcript`,
  );
  return next;
}
