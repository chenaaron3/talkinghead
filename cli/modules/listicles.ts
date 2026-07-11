import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  buildNumberedTranscript,
  wordIndexToOutputFrame,
} from "../helpers/cuts";
import { getResultsOrCached } from "../helpers/transcript-cache";
import type {
  KeepSegment,
  ListicleOverlay,
  TranscriptWord,
} from "../helpers/types";

const MODEL = "gpt-4.1-mini";
const MAX_ITEMS = 5;
const MAX_LABEL_WORDS = 5;

export const ListicleDetectionSchema = z.object({
  listStartWordIndex: z
    .number()
    .int()
    .nonnegative()
    .describe("First word index of the list section"),
  listEndWordIndex: z
    .number()
    .int()
    .nonnegative()
    .describe("Last word index of the list section"),
  items: z
    .array(
      z.object({
        label: z
          .string()
          .describe(`Short on-screen label, max ${MAX_LABEL_WORDS} words`),
        startWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Index of the first spoken word for this point"),
      }),
    )
    .max(MAX_ITEMS)
    .describe("Ordered list items; empty if no listicle found"),
});

export type ListicleDetection = z.infer<typeof ListicleDetectionSchema>;

function clampLabel(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_LABEL_WORDS)
    .join(" ");
}

export function buildListicleOverlay(options: {
  detection: ListicleDetection;
  words: TranscriptWord[];
  segments: KeepSegment[];
  fps: number;
}): ListicleOverlay | null {
  const { detection, words, segments, fps } = options;
  if (detection.items.length === 0) return null;

  const items = [];
  for (const item of detection.items.slice(0, MAX_ITEMS)) {
    const label = clampLabel(item.label);
    if (!label) continue;
    const revealFrame = wordIndexToOutputFrame(
      item.startWordIndex,
      words,
      segments,
      fps,
      "start",
    );
    if (revealFrame == null) continue;
    items.push({ label, revealFrame });
  }

  if (items.length === 0) return null;

  let startFrame = wordIndexToOutputFrame(
    detection.listStartWordIndex,
    words,
    segments,
    fps,
    "start",
  );
  let endFrame = wordIndexToOutputFrame(
    detection.listEndWordIndex,
    words,
    segments,
    fps,
    "end",
  );

  if (startFrame == null) startFrame = items[0]!.revealFrame;
  if (endFrame == null) {
    endFrame = items[items.length - 1]!.revealFrame + Math.round(fps * 2);
  }

  startFrame = Math.min(startFrame, items[0]!.revealFrame);
  endFrame = Math.max(endFrame, items[items.length - 1]!.revealFrame + 1);

  if (endFrame <= startFrame) return null;

  return { startFrame, endFrame, items };
}

async function callOpenAI(words: TranscriptWord[]): Promise<ListicleDetection> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "listicle: true requires OPENAI_API_KEY (set it in .env or the environment)",
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
          "You extract a single ordered listicle from a talking-head transcript.",
          "Return short on-screen labels (max 5 words each) and word indices into the numbered transcript.",
          "If there is no clear numbered/ordered list of tips or points, return items: [].",
          "Prefer the main list the speaker walks through (e.g. One / Number 2 / Number 3).",
          "startWordIndex must be the first word of that point in the transcript.",
          "listStartWordIndex/listEndWordIndex should cover the whole list section.",
          `At most ${MAX_ITEMS} items.`,
        ].join(" "),
      },
      {
        role: "user",
        content: `Numbered transcript words:\n\n${numbered}`,
      },
    ],
    response_format: zodResponseFormat(
      ListicleDetectionSchema,
      "listicle_detection",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI listicle detection failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

export async function detectListicle(options: {
  words: TranscriptWord[];
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<ListicleDetection> {
  const { words, transcriptPath, cachePath, force } = options;

  return getResultsOrCached({
    cachePath,
    transcriptPath,
    force,
    schema: ListicleDetectionSchema,
    compute: async () => {
      console.log(
        `[listicle] detecting list via OpenAI (${MODEL})`,
      );
      const detection = await callOpenAI(words);
      console.log(
        `[listicle] ${detection.items.length} item(s) → ${cachePath}`,
      );
      return detection;
    },
  });
}

/** Detect + map listicle timings into the edited timeline (or null if disabled / none found). */
export async function buildListicle(options: {
  enabled: boolean;
  words: TranscriptWord[];
  segments: KeepSegment[];
  fps: number;
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<ListicleOverlay | null> {
  if (!options.enabled) return null;

  const detection = await detectListicle({
    words: options.words,
    transcriptPath: options.transcriptPath,
    cachePath: options.cachePath,
    force: options.force,
  });

  const listicle = buildListicleOverlay({
    detection,
    words: options.words,
    segments: options.segments,
    fps: options.fps,
  });

  if (listicle) {
    console.log(
      `[listicle] overlay frames ${listicle.startFrame}–${listicle.endFrame} (${listicle.items.length} items)`,
    );
  } else {
    console.log("[listicle] no list detected — skipping overlay");
  }

  return listicle;
}
