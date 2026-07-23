import {
  DEFAULT_CAPTION_STYLE,
  TRENDING_CAPTION_Y,
  type CaptionStyle,
} from "./style";

/** Templates for the episode’s default caption style. */
export const CAPTION_TEMPLATE_IDS = [
  "classic",
  "ugc",
  "beast",
  "hormozi",
] as const;

export type CaptionTemplateId = (typeof CAPTION_TEMPLATE_IDS)[number];

export function isCaptionTemplateId(
  value: unknown,
): value is CaptionTemplateId {
  return (
    typeof value === "string" &&
    (CAPTION_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export type CaptionTemplate = {
  id: CaptionTemplateId;
  label: string;
  style: CaptionStyle;
};

export const DEFAULT_CAPTION_TEMPLATE_ID: CaptionTemplateId = "classic";

export const CAPTION_TEMPLATES: Record<CaptionTemplateId, CaptionTemplate> = {
  classic: {
    id: "classic",
    label: "Classic",
    style: { ...DEFAULT_CAPTION_STYLE },
  },
  ugc: {
    id: "ugc",
    label: "UGC",
    style: {
      fontFamily: "inter",
      fontSize: 40,
      color: "#FFFFFF",
      y: TRENDING_CAPTION_Y,
      animation: "none",
      stroke: { width: 6, color: "#000000" },
      shadow: false,
      textTransform: "lowercase",
      captionsAtATime: 5,
      stack: false,
      backdrop: "none",
    },
  },
  beast: {
    id: "beast",
    label: "Beast",
    style: {
      fontFamily: "montserrat",
      fontSize: 68,
      color: "#FFFFFF",
      y: TRENDING_CAPTION_Y,
      animation: "pop",
      stroke: { width: 10, color: "#000000" },
      shadow: true,
      textTransform: "uppercase",
      captionsAtATime: 3,
      stack: false,
      backdrop: "none",
    },
  },
  hormozi: {
    id: "hormozi",
    label: "Hormozi / Karaoke",
    style: {
      fontFamily: "montserrat",
      fontSize: 64,
      color: "#FFFFFF",
      y: TRENDING_CAPTION_Y,
      animation: "karaoke",
      stroke: { width: 8, color: "#000000" },
      shadow: true,
      textTransform: "uppercase",
      captionsAtATime: 5,
      stack: false,
      backdrop: "none",
    },
  },
};

export const CAPTION_TEMPLATE_LIST: CaptionTemplate[] =
  CAPTION_TEMPLATE_IDS.map((id) => CAPTION_TEMPLATES[id]);

export function resolveCaptionTemplate(
  templateId: CaptionTemplateId,
): CaptionTemplate {
  return (
    CAPTION_TEMPLATES[templateId] ??
    CAPTION_TEMPLATES[DEFAULT_CAPTION_TEMPLATE_ID]
  );
}

export function resolveCaptionTemplateStyle(
  templateId: CaptionTemplateId,
): CaptionStyle {
  return resolveCaptionTemplate(templateId).style;
}

/** Episode default when config omits captionStyle entirely. */
export function defaultEpisodeCaptionStyle(): CaptionStyle {
  return { ...DEFAULT_CAPTION_STYLE };
}
