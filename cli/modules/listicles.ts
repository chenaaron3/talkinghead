import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import {
  buildNumberedTranscript,
  captionIndexToSourceSec,
} from "../helpers/cuts";
import { getResultsOrCached } from "../helpers/transcript-cache";
import {
  DEFAULT_LISTICLE_TEMPLATE_ID,
  resolveListicleTemplate,
} from "../../src/lib/listicle/templates";
import { normalizeCaptionStyle } from "../../src/lib/captions/parse-style";
import type {
  TranscriptCaption,
  SourceListicle,
  SourceListicleTextVfx,
} from "../helpers/types";

export type ListicleBuildResult = {
  overlay: SourceListicle;
  vfx: SourceListicleTextVfx[];
};

const MODEL = "gpt-4.1-mini";
const MIN_ITEMS = 3;
const MAX_ITEMS = 5;
const MAX_TEXT_WORDS = 8;

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
        markerText: z
          .string()
          .describe(
            `Enumeration phrase only, e.g. "number three" — no trailing particles like "is", "the", "are" (max ${MAX_TEXT_WORDS} words)`,
          ),
        markerStartWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("First word of the marker phrase"),
        markerEndWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Last word of the marker phrase (inclusive)"),
        revealText: z
          .string()
          .describe(
            `Spoken list item content, e.g. "Fisherman's Bastion" (max ${MAX_TEXT_WORDS} words)`,
          ),
        revealStartWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("First spoken word of the list item"),
        revealEndWordIndex: z
          .number()
          .int()
          .nonnegative()
          .describe("Last spoken word of the list item (inclusive)"),
      }),
    )
    .max(MAX_ITEMS)
    .describe(
      `Ordered list items (${MIN_ITEMS}–${MAX_ITEMS}); empty if no clear enumerated list`,
    ),
});

export type ListicleDetection = z.infer<typeof ListicleDetectionSchema>;

function clampWords(text: string, maxWords: number): string {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
}

function wordRangeToSec(
  startIndex: number,
  endIndex: number,
  captions: TranscriptCaption[],
): { start: number; end: number } | null {
  const start = captionIndexToSourceSec(startIndex, captions, "start");
  const end = captionIndexToSourceSec(endIndex, captions, "end");
  if (start == null || end == null || end <= start) return null;
  return { start, end };
}

function buildListicleTextVfx(
  listicleItemId: string,
  role: "marker" | "reveal",
  text: string,
  range: { start: number; end: number },
  defaults: { templateId: string; style: ReturnType<typeof normalizeCaptionStyle> },
): SourceListicleTextVfx {
  return {
    id: `${listicleItemId}-${role}`,
    type: "listicle-text",
    listicleItemId,
    role,
    text,
    start: range.start,
    end: range.end,
    templateId: defaults.templateId,
    style: defaults.style,
    sfx: null,
  };
}

export function detectionToListicleOverlay(
  detection: ListicleDetection,
  captions: TranscriptCaption[],
): ListicleBuildResult | null {
  if (detection.items.length < MIN_ITEMS) return null;

  const template = resolveListicleTemplate(DEFAULT_LISTICLE_TEMPLATE_ID);
  const markerDefaults = {
    templateId: template.marker.templateId,
    style: normalizeCaptionStyle(undefined, template.marker.style),
  };
  const revealDefaults = {
    templateId: template.reveal.templateId,
    style: normalizeCaptionStyle(undefined, template.reveal.style),
  };

  const items: SourceListicle["items"] = [];
  const vfx: SourceListicleTextVfx[] = [];

  for (let i = 0; i < detection.items.slice(0, MAX_ITEMS).length; i++) {
    const item = detection.items[i]!;
    const revealText = clampWords(item.revealText, MAX_TEXT_WORDS);
    if (!revealText) continue;

    const markerText = clampWords(item.markerText, MAX_TEXT_WORDS);
    if (!markerText) continue;

    const markerRange = wordRangeToSec(
      item.markerStartWordIndex,
      item.markerEndWordIndex,
      captions,
    );
    const revealRange = wordRangeToSec(
      item.revealStartWordIndex,
      item.revealEndWordIndex,
      captions,
    );
    if (!markerRange || !revealRange) continue;

    const listicleItemId = `listicle-item-${i}`;
    const marker = buildListicleTextVfx(
      listicleItemId,
      "marker",
      markerText,
      markerRange,
      markerDefaults,
    );
    const reveal = buildListicleTextVfx(
      listicleItemId,
      "reveal",
      revealText,
      revealRange,
      revealDefaults,
    );

    items.push({
      id: listicleItemId,
      markerId: marker.id,
      revealId: reveal.id,
    });
    vfx.push(marker, reveal);
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

  if (start == null) start = vfx[0]!.start;
  if (end == null) {
    const last = captions[captions.length - 1];
    end = last ? last.end : vfx[vfx.length - 1]!.end + 0.5;
  }

  start = Math.min(start, vfx[0]!.start);
  end = Math.max(end, vfx[vfx.length - 1]!.end + 0.5);

  if (end <= start) return null;

  return {
    overlay: {
      start,
      end,
      templateId: DEFAULT_LISTICLE_TEMPLATE_ID,
      items,
    },
    vfx,
  };
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
          "For each item return:",
          "- markerText + marker word indices: the spoken enumeration only (e.g. 'number three' — never trailing 'is' / 'the').",
          "- revealText + reveal word indices: the spoken list item content (e.g. 'Fisherman's Bastion').",
          "Prefer the main enumerated list the speaker walks through.",
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
}): Promise<ListicleBuildResult | null> {
  if (!options.enabled) return null;

  const detection = await detectListicle({
    captions: options.captions,
    transcriptPath: options.transcriptPath,
    cachePath: options.cachePath,
    force: options.force,
  });

  const result = detectionToListicleOverlay(detection, options.captions);

  if (result) {
    console.log(
      `[listicle] overlay ${result.overlay.start.toFixed(2)}–${result.overlay.end.toFixed(2)}s (${result.overlay.items.length} items, ${result.vfx.length} clips)`,
    );
  } else {
    console.log("[listicle] no list detected — skipping overlay");
  }

  return result;
}
