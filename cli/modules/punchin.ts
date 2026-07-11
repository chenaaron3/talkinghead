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
  PunchInSegment,
  TranscriptWord,
} from "../helpers/types";

const MODEL = "gpt-4.1-mini";
const MAX_PUNCH_INS = 10;
const MIN_DURATION_SEC = 0.8;
const MAX_DURATION_SEC = 3;
const MIN_GAP_SEC = 2;

const SCALE_BY_STRENGTH = {
  subtle: 1.06,
  strong: 1.12,
} as const;

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
          .enum(["subtle", "strong"])
          .describe("subtle ≈ 1.06x zoom, strong ≈ 1.12x"),
        reason: z
          .string()
          .describe("Why this moment deserves emphasis, one short sentence"),
      }),
    )
    .max(MAX_PUNCH_INS),
});

export type PunchInDetection = z.infer<typeof PunchInDetectionSchema>;

export function buildPunchInSegments(options: {
  detection: PunchInDetection;
  words: TranscriptWord[];
  segments: KeepSegment[];
  fps: number;
}): PunchInSegment[] {
  const { detection, words, segments, fps } = options;

  const minFrames = Math.round(MIN_DURATION_SEC * fps);
  const maxFrames = Math.round(MAX_DURATION_SEC * fps);
  const minGapFrames = Math.round(MIN_GAP_SEC * fps);

  const segmentRanges: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const seg of segments) {
    segmentRanges.push({ start: cursor, end: cursor + seg.durationInFrames });
    cursor += seg.durationInFrames;
  }

  const mapped: PunchInSegment[] = [];
  for (const item of detection.punchIns.slice(0, MAX_PUNCH_INS)) {
    if (item.endWordIndex < item.startWordIndex) continue;

    const startFrame = wordIndexToOutputFrame(
      item.startWordIndex,
      words,
      segments,
      fps,
      "start",
    );
    const endFrameRaw = wordIndexToOutputFrame(
      item.endWordIndex,
      words,
      segments,
      fps,
      "end",
    );
    if (startFrame == null || endFrameRaw == null) continue;
    if (endFrameRaw < startFrame) continue;

    const duration = Math.min(
      maxFrames,
      Math.max(minFrames, endFrameRaw - startFrame),
    );
    const endFrame = startFrame + duration;

    // A zoom that persists across a hard cut reads as a glitch.
    const withinOneSegment = segmentRanges.some(
      (range) => startFrame >= range.start && endFrame <= range.end,
    );
    if (!withinOneSegment) continue;

    mapped.push({
      startFrame,
      endFrame,
      scale: SCALE_BY_STRENGTH[item.strength],
    });
  }

  mapped.sort((a, b) => a.startFrame - b.startFrame);

  const result: PunchInSegment[] = [];
  for (const punchIn of mapped) {
    const last = result[result.length - 1];
    if (last && punchIn.startFrame - last.endFrame < minGapFrames) continue;
    result.push(punchIn);
  }

  return result;
}

async function callOpenAI(words: TranscriptWord[]): Promise<PunchInDetection> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "punchIns: true requires OPENAI_API_KEY (set it in .env or the environment)",
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
  words: TranscriptWord[];
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<PunchInDetection> {
  const { words, transcriptPath, cachePath, force } = options;

  return getResultsOrCached({
    cachePath,
    transcriptPath,
    force,
    schema: PunchInDetectionSchema,
    compute: async () => {
      console.log(
        `[punch-in] detecting emphasis moments via OpenAI (${MODEL})`,
      );
      const detection = await callOpenAI(words);
      console.log(
        `[punch-in] ${detection.punchIns.length} candidate(s) → ${cachePath}`,
      );
      return detection;
    },
  });
}

/** Detect + map punch-ins into the edited timeline (or null if disabled / none survive). */
export async function buildPunchIns(options: {
  enabled: boolean;
  words: TranscriptWord[];
  segments: KeepSegment[];
  fps: number;
  transcriptPath: string;
  cachePath: string;
  force: boolean;
}): Promise<PunchInSegment[] | null> {
  if (!options.enabled) return null;

  const detection = await detectPunchIns({
    words: options.words,
    transcriptPath: options.transcriptPath,
    cachePath: options.cachePath,
    force: options.force,
  });

  const punchIns = buildPunchInSegments({
    detection,
    words: options.words,
    segments: options.segments,
    fps: options.fps,
  });

  if (punchIns.length === 0) {
    console.log("[punch-in] no usable punch-ins — skipping");
    return null;
  }

  console.log(
    `[punch-in] ${punchIns.length} punch-in(s) at frames ${punchIns
      .map((p) => `${p.startFrame}–${p.endFrame}`)
      .join(", ")}`,
  );
  return punchIns;
}
