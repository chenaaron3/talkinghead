import {
  QUOTE_CAPTION_Y,
  type CaptionStyle,
} from "./style";

/** Templates for Quote VFX (sparing highlight looks). */
export const QUOTE_TEMPLATE_IDS = [
  "bold-white",
  "bold-white-stack",
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
  style: CaptionStyle;
};

export const DEFAULT_QUOTE_TEMPLATE_ID: QuoteTemplateId = "handwritten-white";

const BOLD_WHITE_BASE: CaptionStyle = {
  fontFamily: "montserrat",
  fontSize: 72,
  color: "#FFFFFF",
  y: QUOTE_CAPTION_Y,
  animation: "fade",
  stroke: null,
  shadow: false,
  textTransform: "uppercase",
  captionsAtATime: 1,
  stack: false,
  backdrop: "none",
};

export const QUOTE_TEMPLATES: Record<QuoteTemplateId, QuoteTemplate> = {
  "bold-white": {
    id: "bold-white",
    label: "Bold White",
    style: { ...BOLD_WHITE_BASE },
  },
  "bold-white-stack": {
    id: "bold-white-stack",
    label: "Bold White · 2 Lines",
    style: {
      ...BOLD_WHITE_BASE,
      fontSize: 42,
      captionsAtATime: 8,
      stack: true,
    },
  },
  "handwritten-white": {
    id: "handwritten-white",
    label: "Handwritten",
    style: {
      fontFamily: "pacifico",
      fontSize: 64,
      color: "#FFFFFF",
      y: QUOTE_CAPTION_Y,
      animation: "fade",
      stroke: null,
      shadow: false,
      textTransform: "uppercase",
      captionsAtATime: 3,
      stack: false,
      backdrop: "none",
    },
  },
  "handwritten-box": {
    id: "handwritten-box",
    label: "Handwritten Box",
    style: {
      fontFamily: "pacifico",
      fontSize: 58,
      color: "#FFFFFF",
      y: QUOTE_CAPTION_Y,
      animation: "fade",
      stroke: null,
      shadow: false,
      textTransform: "uppercase",
      captionsAtATime: 3,
      stack: false,
      backdrop: "box",
    },
  },
  scrappy: {
    id: "scrappy",
    label: "Scrappy",
    style: {
      fontFamily: "nunito",
      fontSize: 56,
      color: "#111111",
      y: QUOTE_CAPTION_Y,
      animation: "fade",
      stroke: null,
      shadow: false,
      textTransform: "uppercase",
      captionsAtATime: 8,
      stack: false,
      backdrop: "scrap",
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
): CaptionStyle {
  return resolveQuoteTemplate(templateId).style;
}
