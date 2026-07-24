import { QUOTE_CAPTION_Y, type CaptionStyle } from "../captions/style";
import {
  DEFAULT_TEXT_TEMPLATE_ID,
  isTextTemplateId,
  resolveTextTemplateStyle,
  type TextTemplateId,
} from "../text/templates";

export const LISTICLE_TEMPLATE_IDS = [
  "minimal-glow-scrappy",
  "aggregated-board",
] as const;

export type ListicleTemplateId = (typeof LISTICLE_TEMPLATE_IDS)[number];

export function isListicleTemplateId(
  value: unknown,
): value is ListicleTemplateId {
  return (
    typeof value === "string" &&
    (LISTICLE_TEMPLATE_IDS as readonly string[]).includes(value)
  );
}

export const DEFAULT_LISTICLE_TEMPLATE_ID: ListicleTemplateId =
  "minimal-glow-scrappy";

/** Default marker/reveal text VFX fields (no id, start, end, or copy). */
export type ListicleTextDefaults = {
  templateId: TextTemplateId;
  style: CaptionStyle;
};

export type ListicleTemplate = {
  id: ListicleTemplateId;
  label: string;
  /** When true, show accumulating board; when false, marker/reveal text only. */
  aggregated: boolean;
  marker: ListicleTextDefaults;
  reveal: ListicleTextDefaults;
};

const GLOW_MARKER_STYLE: CaptionStyle = {
  fontFamily: "montserrat",
  fontSize: 72,
  color: "#F5EDB8",
  y: QUOTE_CAPTION_Y,
  animation: "fade",
  stroke: null,
  shadow: false,
  textTransform: "uppercase",
  captionsAtATime: 1,
  stack: false,
  backdrop: "none",
  fontStyle: "normal",
  textAlign: "center",
  backdropColor: null,
  textShadow:
    "0 0 16px rgba(255, 220, 90, 0.95), 0 0 32px rgba(255, 200, 60, 0.7), 0 0 48px rgba(255, 180, 40, 0.45)",
};

const SCRAPPY_REVEAL_STYLE: CaptionStyle = {
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
  fontStyle: "normal",
  textAlign: "center",
  backdropColor: null,
};

const BOARD_REVEAL_STYLE: CaptionStyle = resolveTextTemplateStyle(
  DEFAULT_TEXT_TEMPLATE_ID,
);

export const LISTICLE_TEMPLATES: Record<ListicleTemplateId, ListicleTemplate> =
  {
    "minimal-glow-scrappy": {
      id: "minimal-glow-scrappy",
      label: "Minimal · Glow + Scrappy",
      aggregated: false,
      marker: { templateId: "glow", style: GLOW_MARKER_STYLE },
      reveal: { templateId: "scrappy", style: SCRAPPY_REVEAL_STYLE },
    },
    "aggregated-board": {
      id: "aggregated-board",
      label: "Aggregated Board",
      aggregated: true,
      marker: { templateId: "glow", style: GLOW_MARKER_STYLE },
      reveal: { templateId: "stamp", style: BOARD_REVEAL_STYLE },
    },
  };

export const LISTICLE_TEMPLATE_LIST: ListicleTemplate[] =
  LISTICLE_TEMPLATE_IDS.map((id) => LISTICLE_TEMPLATES[id]);

export function resolveListicleTemplate(
  templateId: string,
): ListicleTemplate {
  if (isListicleTemplateId(templateId)) {
    return LISTICLE_TEMPLATES[templateId];
  }
  return LISTICLE_TEMPLATES[DEFAULT_LISTICLE_TEMPLATE_ID];
}

export function resolveListicleTemplateId(
  overlay: { templateId?: string } | null | undefined,
): ListicleTemplateId {
  const raw = overlay?.templateId?.trim();
  if (raw && isListicleTemplateId(raw)) return raw;
  return DEFAULT_LISTICLE_TEMPLATE_ID;
}

/** Resolve a text template id stored on a listicle clip (may be listicle-only ids). */
export function resolveListicleTextTemplateId(
  templateId: string,
): TextTemplateId {
  if (isTextTemplateId(templateId)) return templateId;
  return DEFAULT_TEXT_TEMPLATE_ID;
}
