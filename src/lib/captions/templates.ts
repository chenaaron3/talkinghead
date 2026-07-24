import {
  DEFAULT_CAPTION_STYLE,
  TRENDING_CAPTION_Y,
  type CaptionGroupStyle,
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
  style: CaptionGroupStyle;
};

export const DEFAULT_CAPTION_TEMPLATE_ID: CaptionTemplateId = "classic";

const SHADOW = "0 3px 0 #000, 0 6px 16px rgba(0,0,0,0.85)";

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
      y: TRENDING_CAPTION_Y,
      animation: "none",
      textTransform: "lowercase",
      captionsAtATime: 5,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        border: { width: 6, color: "#000000" },
        opacity: 1,
      },
    },
  },
  beast: {
    id: "beast",
    label: "Beast",
    style: {
      fontFamily: "montserrat",
      fontSize: 68,
      y: TRENDING_CAPTION_Y,
      animation: "scale",
      textTransform: "uppercase",
      captionsAtATime: 3,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        border: { width: 10, color: "#000000" },
        opacity: 1,
        textShadow: SHADOW,
      },
    },
  },
  hormozi: {
    id: "hormozi",
    label: "Hormozi / Karaoke",
    style: {
      fontFamily: "montserrat",
      fontSize: 64,
      y: TRENDING_CAPTION_Y,
      animation: "none",
      textTransform: "uppercase",
      captionsAtATime: 5,
      background: { kind: "none" },
      fontStyle: "normal",
      textAlign: "center",
      wordStyle: {
        fill: "#FFFFFF",
        border: { width: 8, color: "#000000" },
        opacity: 1,
        textShadow: SHADOW,
      },
      futureWordStyle: { opacity: 0.35 },
      activeWordStyle: {
        fill: "#FFE600",
        background: { kind: "rounded", color: "rgba(255, 230, 0, 0.25)" },
      },
      pastWordStyle: { opacity: 1 },
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
): CaptionGroupStyle {
  return resolveCaptionTemplate(templateId).style;
}

/** Episode default when config omits caption style entirely. */
export function defaultEpisodeCaptionStyle(): CaptionGroupStyle {
  return { ...DEFAULT_CAPTION_STYLE };
}
