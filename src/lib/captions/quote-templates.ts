import {
  QUOTE_CAPTION_Y,
  type CaptionGroupStyle,
} from "./style";

/** Templates for Quote VFX (sparing highlight looks). */
export const QUOTE_TEMPLATE_IDS = [
  "bold-white",
  "handwritten-white",
  "handwritten-box",
  "scrappy",
] as const;

export type QuoteTemplateId = (typeof QUOTE_TEMPLATE_IDS)[number];

export function isQuoteTemplateId(value: unknown): value is QuoteTemplateId {
  return (
    typeof value === "string" &&
    (QUOTE_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export type QuoteTemplate = {
  id: QuoteTemplateId;
  label: string;
  style: CaptionGroupStyle;
};

export const DEFAULT_QUOTE_TEMPLATE_ID: QuoteTemplateId = "handwritten-white";

const BOLD_WHITE_BASE: CaptionGroupStyle = {
  fontFamily: "montserrat",
  fontSize: 72,
  y: QUOTE_CAPTION_Y,
  animation: "fade",
  textTransform: "uppercase",
  captionsAtATime: 1,
  background: { kind: "none" },
  fontStyle: "normal",
  textAlign: "center",
  wordStyle: {
    fill: "#FFFFFF",
    opacity: 1,
  },
};

export const QUOTE_TEMPLATES: Record<QuoteTemplateId, QuoteTemplate> = {
  "bold-white": {
    id: "bold-white",
    label: "Bold White",
    style: { ...BOLD_WHITE_BASE },
  },
  "handwritten-white": {
    id: "handwritten-white",
    label: "Handwritten",
    style: {
      fontFamily: "pacifico",
      fontSize: 64,
      y: QUOTE_CAPTION_Y,
      animation: "fade",
      textTransform: "uppercase",
      captionsAtATime: 3,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        opacity: 1,
      },
    },
  },
  "handwritten-box": {
    id: "handwritten-box",
    label: "Handwritten Box",
    style: {
      fontFamily: "pacifico",
      fontSize: 58,
      y: QUOTE_CAPTION_Y,
      animation: "fade",
      textTransform: "uppercase",
      captionsAtATime: 3,
      background: { kind: "box", color: "rgba(0, 0, 0, 0.82)" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        opacity: 1,
      },
    },
  },
  scrappy: {
    id: "scrappy",
    label: "Scrappy",
    style: {
      fontFamily: "nunito",
      fontSize: 56,
      y: QUOTE_CAPTION_Y,
      animation: "fade",
      textTransform: "uppercase",
      captionsAtATime: 8,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#111111",
        opacity: 1,
        background: { kind: "scrap", color: "#FFFFFF" },
      },
    },
  },
};

export const QUOTE_TEMPLATE_LIST: QuoteTemplate[] = QUOTE_TEMPLATE_IDS.map(
  (id) => QUOTE_TEMPLATES[id],
);

export function resolveQuoteTemplate(
  templateId: QuoteTemplateId,
): QuoteTemplate {
  return (
    QUOTE_TEMPLATES[templateId] ?? QUOTE_TEMPLATES[DEFAULT_QUOTE_TEMPLATE_ID]
  );
}

export function resolveQuoteTemplateStyle(
  templateId: QuoteTemplateId,
): CaptionGroupStyle {
  return resolveQuoteTemplate(templateId).style;
}
