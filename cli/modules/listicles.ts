import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  buildNumberedTranscript,
  captionIndexToSourceSec,
} from "../helpers/cuts";
import { getResultsOrCached } from "../helpers/transcript-cache";
import type { TranscriptCaption, SourceListicle } from "../helpers/types";

const MODEL = "gpt-4.1-mini";
const MIN_ITEMS = 3;
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
    .describe(
      `Ordered list items (${MIN_ITEMS}–${MAX_ITEMS}); empty if no clear enumerated list`,
    ),
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

export function detectionToListicleOverlay(
  detection: ListicleDetection,
  captions: TranscriptCaption[],
): SourceListicle | null {
  if (detection.items.length < MIN_ITEMS) return null;

  const items = [];
  for (const item of detection.items.slice(0, MAX_ITEMS)) {
    const label = clampLabel(item.label);
    if (!label) continue;
    const reveal = captionIndexToSourceSec(
      item.startWordIndex,
      captions,
      "start",
    );
    if (reveal == null) continue;
    items.push({ label, reveal });
  }

  if (items.length < MIN_ITEMS) return null;

  let start = captionIndexToSourceSec(
    detection.listStartWordIndex,
    captions,
    "start",
  );
  let end = captionIndexToSourceSec(
    detection.listEndWordIndex,
    captions,
    "end",
  );

  if (start == null) start = items[0]!.reveal;
  if (end == null) {
    const last = captions[captions.length - 1];
    end = last ? last.end : items[items.length - 1]!.reveal + 2;
  }

  start = Math.min(start, items[0]!.reveal);
  end = Math.max(end, items[items.length - 1]!.reveal + 0.5);

  if (end <= start) return null;

  return { start, end, items };
}

async function callOpenAI(captions: TranscriptCaption[]): Promise<ListicleDetection> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "listicle: true requires OPENAI_API_KEY (set it in .env or the environment)",
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
          "You extract a single ordered listicle from a talking-head transcript.",
          "ONLY return a list when the speaker explicitly enumerates distinct points",
          "(e.g. one / two / three, first / second / third, number 1 / number 2, tip one / tip two).",
          "Vague sequential tips, 'also…', 'next…', or implied structure without enumeration → items: [].",
          `Require at least ${MIN_ITEMS} enumerated points; fewer than ${MIN_ITEMS} → items: [].`,
          "Return short on-screen labels (max 5 words each) and word indices into the numbered transcript.",
          "Prefer the main enumerated list the speaker walks through.",
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
  captions: TranscriptCaption[];
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<ListicleDetection> {
  const { captions, transcriptPath, cachePath, force } = options;

  return getResultsOrCached({
    cachePath,
    transcriptPath,
    force,
    schema: ListicleDetectionSchema,
    compute: async () => {
      console.log(`[listicle] detecting list via OpenAI (${MODEL})`);
      const detection = await callOpenAI(captions);
      console.log(
        `[listicle] ${detection.items.length} item(s) → ${cachePath}`,
      );
      return detection;
    },
  });
}

/** Detect listicle and return source-time overlay (or null if disabled / none found). */
export async function buildListicleOverlay(options: {
  enabled: boolean;
  captions: TranscriptCaption[];
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<SourceListicle | null> {
  if (!options.enabled) return null;

  const detection = await detectListicle({
    captions: options.captions,
    transcriptPath: options.transcriptPath,
    cachePath: options.cachePath,
    force: options.force,
  });

  const overlay = detectionToListicleOverlay(detection, options.captions);

  if (overlay) {
    console.log(
      `[listicle] overlay ${overlay.start.toFixed(2)}–${overlay.end.toFixed(2)}s (${overlay.items.length} items)`,
    );
  } else {
    console.log("[listicle] no list detected — skipping overlay");
  }

  return overlay;
}
