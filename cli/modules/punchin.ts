import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  buildNumberedTranscript,
  captionIndexToSourceSec,
} from "../helpers/cuts";
import { getResultsOrCached } from "../helpers/transcript-cache";
import { PUNCH_IN_STRENGTH } from "../../src/lib/punchin";
import type { TranscriptCaption, SourcePunchIn } from "../helpers/types";

const MODEL = "gpt-4.1-mini";
const MAX_PUNCH_INS = 10;
const MIN_DURATION_SEC = 0.8;
const MAX_DURATION_SEC = 3;
const MIN_GAP_SEC = 2;

export const PunchInDetectionSchema = z.object({
  punchIns: z
    .array(
      z.object({
        startWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("First word of the emphasized phrase"),
        endWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Last word of the emphasized phrase"),
        strength: z
          .enum(["light", "medium", "strong"])
          .describe("light ≈ 1.06x, medium ≈ 1.12x, strong ≈ 1.20x"),
        reason: z
          .string()
          .describe("Why this moment deserves emphasis, one short sentence"),
      }),
    )
    .max(MAX_PUNCH_INS),
});

export type PunchInDetection = z.infer<typeof PunchInDetectionSchema>;

export function detectionToPunchInSegments(
  detection: PunchInDetection,
  captions: TranscriptCaption[],
): SourcePunchIn[] {
  const mapped: SourcePunchIn[] = [];

  for (const item of detection.punchIns.slice(0, MAX_PUNCH_INS)) {
    if (item.endWordIndex < item.startWordIndex) continue;

    const start = captionIndexToSourceSec(
      item.startWordIndex,
      captions,
      "start",
    );
    const endRaw = captionIndexToSourceSec(
      item.endWordIndex,
      captions,
      "end",
    );
    if (start == null || endRaw == null) continue;
    if (endRaw < start) continue;

    const duration = Math.min(
      MAX_DURATION_SEC,
      Math.max(MIN_DURATION_SEC, endRaw - start),
    );
    const end = start + duration;

    mapped.push({
      start,
      end,
      scale: PUNCH_IN_STRENGTH[item.strength],
    });
  }

  mapped.sort((a, b) => a.start - b.start);

  const result: SourcePunchIn[] = [];
  for (const punchIn of mapped) {
    const last = result[result.length - 1];
    if (last && punchIn.start - last.end < MIN_GAP_SEC) continue;
    result.push(punchIn);
  }

  return result;
}

async function callOpenAI(captions: TranscriptCaption[]): Promise<PunchInDetection> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "punchIns: true requires OPENAI_API_KEY (set it in .env or the environment)",
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
          "You pick moments in a talking-head transcript where a quick camera punch-in (zoom) would add impact.",
          "Look for hooks, payoffs, surprising statements, and key numbers.",
          "Return word indices into the numbered transcript: startWordIndex is the first word of the emphasized phrase, endWordIndex the last word.",
          "Prefer short phrases of a few words over whole sentences.",
          'Use strength "strong" only for the biggest moments; otherwise "subtle".',
          "Give a one-sentence reason for each pick.",
          `At most ${MAX_PUNCH_INS} punch-ins; fewer well-chosen moments beat forced ones. Return an empty array if nothing stands out.`,
        ].join(" "),
      },
      {
        role: "user",
        content: `Numbered transcript words:\n\n${numbered}`,
      },
    ],
    response_format: zodResponseFormat(
      PunchInDetectionSchema,
      "punch_in_detection",
    ),
  });

  const parsed = completion.choices[0]?.message.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message.refusal;
    throw new Error(
      `OpenAI punch-in detection failed${refusal ? `: ${refusal}` : ""}`,
    );
  }

  return parsed;
}

export async function detectPunchIns(options: {
  captions: TranscriptCaption[];
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<PunchInDetection> {
  const { captions, transcriptPath, cachePath, force } = options;

  return getResultsOrCached({
    cachePath,
    transcriptPath,
    force,
    schema: PunchInDetectionSchema,
    compute: async () => {
      console.log(
        `[punch-in] detecting emphasis moments via OpenAI (${MODEL})`,
      );
      const detection = await callOpenAI(captions);
      console.log(
        `[punch-in] ${detection.punchIns.length} candidate(s) → ${cachePath}`,
      );
      return detection;
    },
  });
}

/** Detect punch-ins and return source-time segments (or empty if disabled). */
export async function buildPunchInSegments(options: {
  enabled: boolean;
  captions: TranscriptCaption[];
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<SourcePunchIn[]> {
  if (!options.enabled) return [];

  const detection = await detectPunchIns({
    captions: options.captions,
    transcriptPath: options.transcriptPath,
    cachePath: options.cachePath,
    force: options.force,
  });

  const punchIns = detectionToPunchInSegments(detection, options.captions);

  if (punchIns.length === 0) {
    console.log("[punch-in] no usable punch-ins — skipping");
    return [];
  }

  console.log(
    `[punch-in] ${punchIns.length} punch-in(s) at ${punchIns
      .map((p) => `${p.start.toFixed(2)}–${p.end.toFixed(2)}s`)
      .join(", ")}`,
  );
  return punchIns;
}
