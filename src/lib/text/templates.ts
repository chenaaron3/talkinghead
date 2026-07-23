import {
  QUOTE_CAPTION_Y,
  type CaptionStyle,
} from "../captions/style";

export const TEXT_TEMPLATE_IDS = [
  "typewriter",
  "white-board",
  "stamp",
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
  style: CaptionStyle;
};

/** Default on-screen text VFX — yellow stamp board. */
export const DEFAULT_TEXT_STYLE: CaptionStyle = {
  fontFamily: "montserrat",
  fontSize: 68,
  color: "#111111",
  y: QUOTE_CAPTION_Y,
  animation: "pop",
  stroke: null,
  // Soft text-shadow makes board look muddy; boards use a crisp lift instead.
  shadow: false,
  textTransform: "uppercase",
  captionsAtATime: 1,
  stack: false,
  backdrop: "box",
  fontStyle: "normal",
  textAlign: "center",
  backdropColor: "#FFE600",
  contourBoard: false,
};

export const DEFAULT_TEXT_TEMPLATE_ID: TextTemplateId = "stamp";

export const TEXT_TEMPLATES: Record<TextTemplateId, TextTemplate> = {
  typewriter: {
    id: "typewriter",
    label: "Typewriter",
    style: {
      fontFamily: "inter",
      fontSize: 78,
      color: "#FFFFFF",
      y: QUOTE_CAPTION_Y,
      animation: "typewriter",
      stroke: { width: 6, color: "#000000" },
      shadow: false,
      textTransform: "uppercase",
      captionsAtATime: 1,
      stack: false,
      backdrop: "none",
      fontStyle: "italic",
      textAlign: "left",
      backdropColor: null,
      contourBoard: false,
    },
  },
  "white-board": {
    id: "white-board",
    label: "White Board",
    style: {
      fontFamily: "inter",
      fontSize: 62,
      color: "#111111",
      y: QUOTE_CAPTION_Y,
      animation: "pop",
      stroke: null,
      shadow: false,
      textTransform: "none",
      captionsAtATime: 1,
      stack: false,
      backdrop: "box",
      fontStyle: "normal",
      textAlign: "center",
      backdropColor: "#FFFFFF",
      contourBoard: true,
    },
  },
  stamp: {
    id: "stamp",
    label: "Stamp",
    style: { ...DEFAULT_TEXT_STYLE },
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
): CaptionStyle {
  return resolveTextTemplate(templateId).style;
}
