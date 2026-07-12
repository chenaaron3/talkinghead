import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { getResultsOrCached } from '../helpers/transcript-cache';

import type { TranscriptWord } from "../helpers/types";

const MODEL = "gpt-4.1-mini";
const MAX_TITLE_WORDS = 5;

export const TitleDetectionSchema = z.object({
  title: z
    .string()
    .describe(
      `Punchy on-screen / post title, Title Case, max ${MAX_TITLE_WORDS} words`,
    )
    .refine(
      (value) => {
        const words = value.trim().split(/\s+/).filter(Boolean);
        return words.length >= 1 && words.length <= MAX_TITLE_WORDS;
      },
      { message: `Title must be 1–${MAX_TITLE_WORDS} words` },
    ),
});

export type TitleDetection = z.infer<typeof TitleDetectionSchema>;

function transcriptText(words: TranscriptWord[]): string {
  return words
    .map((w) => w.word.trim())
    .filter(Boolean)
    .join(" ");
}

async function callOpenAI(words: TranscriptWord[]): Promise<TitleDetection> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Auto title requires OPENAI_API_KEY (set it in .env or the environment)",
    );
  }

  const client = new OpenAI({ apiKey });
  const text = transcriptText(words);

  const completion = await client.chat.completions.parse({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: [
          "You write short titles for talking-head social videos.",
          `Max ${MAX_TITLE_WORDS} words. Title Case. Punchy and concrete`,
          "No hashtags, emoji, quotes, or trailing punctuation.",
          "Capture the main topic; do not invent a series name unless the speaker says one.",
        ].join(" "),
      },
      {
        role: "user",
        content: `Transcript:\n\n${text}`,
      },
    ],
    response_format: zodResponseFormat(TitleDetectionSchema, "title_detection"),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI title generation failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

/** Generate a ≤5-word title from the transcript (cached). */
export async function buildTitle(options: {
  words: TranscriptWord[];
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<string> {
  const { words, transcriptPath, cachePath, force } = options;

  const detection = await getResultsOrCached({
    cachePath,
    transcriptPath,
    force,
    schema: TitleDetectionSchema,
    compute: async () => {
      console.log(`[title] generating via OpenAI (${MODEL})`);
      return callOpenAI(words);
    },
  });

  console.log(`[title] "${detection.title}"`);
  return detection.title;
}
