import { QUOTE_CAPTION_Y } from "../captions/style";

import type { CaptionGroupStyle } from "../captions/style";

export const TEXT_TEMPLATE_IDS = [
  "typewriter",
  "white-board",
  "stamp",
  "glow",
  "scrappy",
] as const;

export type TextTemplateId = (typeof TEXT_TEMPLATE_IDS)[number];

export function isTextTemplateId(value: unknown): value is TextTemplateId {
  return (
    typeof value === "string" &&
    (TEXT_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export type TextTemplate = {
  id: TextTemplateId;
  label: string;
  style: CaptionGroupStyle;
};

/** Default on-screen text VFX — yellow stamp board. */
export const DEFAULT_TEXT_STYLE: CaptionGroupStyle = {
  fontFamily: "montserrat",
  fontSize: 68,
  y: QUOTE_CAPTION_Y,
  animation: "scale",
  textTransform: "uppercase",
  captionsAtATime: 1,
  background: { kind: "box", color: "#FFE600" },
  fontStyle: "normal",
  textAlign: "center",
  wordStyle: {
    fill: "#111111",
    opacity: 1,
  },
};

export const DEFAULT_TEXT_TEMPLATE_ID: TextTemplateId = "stamp";

export const TEXT_TEMPLATES: Record<TextTemplateId, TextTemplate> = {
  typewriter: {
    id: "typewriter",
    label: "Typewriter",
    style: {
      fontFamily: "inter",
      fontSize: 78,
      y: QUOTE_CAPTION_Y,
      animation: "typewriter",
      textTransform: "uppercase",
      captionsAtATime: 1,
      background: { kind: "none" },
      fontStyle: "italic",
      textAlign: "left",
      wordStyle: {
        fill: "#FFFFFF",
        border: { width: 6, color: "#000000" },
        opacity: 1,
      },
    },
  },
  "white-board": {
    id: "white-board",
    label: "White Board",
    style: {
      fontFamily: "inter",
      fontSize: 62,
      y: QUOTE_CAPTION_Y,
      animation: "fade",
      textTransform: "none",
      captionsAtATime: 1,
      background: { kind: "wrap", color: "#FFFFFF" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#111111",
        opacity: 1,
      },
    },
  },
  stamp: {
    id: "stamp",
    label: "Stamp",
    style: { ...DEFAULT_TEXT_STYLE },
  },
  glow: {
    id: "glow",
    label: "Glow",
    style: {
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
        fill: "#F5EDB8",
        opacity: 1,
        textShadow:
          "0 0 16px rgba(255, 220, 90, 0.95), 0 0 32px rgba(255, 200, 60, 0.7), 0 0 48px rgba(255, 180, 40, 0.45)",
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

export const TEXT_TEMPLATE_LIST: TextTemplate[] = TEXT_TEMPLATE_IDS.map(
  (id) => TEXT_TEMPLATES[id],
);

export function resolveTextTemplate(templateId: TextTemplateId): TextTemplate {
  return TEXT_TEMPLATES[templateId] ?? TEXT_TEMPLATES[DEFAULT_TEXT_TEMPLATE_ID];
}

export function resolveTextTemplateStyle(
  templateId: TextTemplateId,
): CaptionGroupStyle {
  return resolveTextTemplate(templateId).style;
}
