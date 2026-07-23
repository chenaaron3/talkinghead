import {
  QUOTE_CAPTION_Y,
  type CaptionStyle,
} from "../captions/style";
import { normalizeCaptionStyle } from "../captions/parse-style";

export const TITLE_TEMPLATE_IDS = [
  "typewriter",
  "white-board",
  "stamp",
] as const;

export type TitleTemplateId = (typeof TITLE_TEMPLATE_IDS)[number];

export function isTitleTemplateId(value: unknown): value is TitleTemplateId {
  return (
    typeof value === "string" &&
    (TITLE_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export type TitleTemplate = {
  id: TitleTemplateId;
  label: string;
  style: CaptionStyle;
};

/** Default on-screen title — yellow stamp board. */
export const DEFAULT_TITLE_STYLE: CaptionStyle = {
  fontFamily: "montserrat",
  fontSize: 68,
  color: "#111111",
  y: QUOTE_CAPTION_Y,
  animation: "pop",
  stroke: null,
  // Soft text-shadow makes board titles look muddy; boards use a crisp lift instead.
  shadow: false,
  textTransform: "uppercase",
  captionsAtATime: 1,
  stack: false,
  backdrop: "box",
  fontStyle: "normal",
  textAlign: "center",
  backdropColor: "#FFE600",
};

export const DEFAULT_TITLE_TEMPLATE_ID: TitleTemplateId = "stamp";

export const TITLE_TEMPLATES: Record<TitleTemplateId, TitleTemplate> = {
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
    },
  },
  stamp: {
    id: "stamp",
    label: "Stamp",
    style: { ...DEFAULT_TITLE_STYLE },
  },
};

export const TITLE_TEMPLATE_LIST: TitleTemplate[] = TITLE_TEMPLATE_IDS.map(
  (id) => TITLE_TEMPLATES[id],
);

export function resolveTitleTemplate(templateId: TitleTemplateId): TitleTemplate {
  return TITLE_TEMPLATES[templateId] ?? TITLE_TEMPLATES[DEFAULT_TITLE_TEMPLATE_ID];
}

export function resolveTitleTemplateStyle(
  templateId: TitleTemplateId,
): CaptionStyle {
  return resolveTitleTemplate(templateId).style;
}

/** Episode default when config omits titleStyle. */
export function defaultEpisodeTitleStyle(): CaptionStyle {
  return normalizeCaptionStyle(DEFAULT_TITLE_STYLE, DEFAULT_TITLE_STYLE);
}
