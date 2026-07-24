import type { CaptionGroupStyle } from "../captions/style";
import {
  DEFAULT_TEXT_TEMPLATE_ID,
  isTextTemplateId,
  resolveTextTemplateStyle,
  TEXT_TEMPLATES,
} from "../text/templates";

import type { TextTemplateId } from "../text/templates";

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
  style: CaptionGroupStyle;
};

export type ListicleTemplate = {
  id: ListicleTemplateId;
  label: string;
  /** When true, show accumulating board; when false, marker/reveal text only. */
  aggregated: boolean;
  marker: ListicleTextDefaults;
  reveal: ListicleTextDefaults;
};

export const LISTICLE_TEMPLATES: Record<ListicleTemplateId, ListicleTemplate> =
  {
    "minimal-glow-scrappy": {
      id: "minimal-glow-scrappy",
      label: "Minimal · Glow + Scrappy",
      aggregated: false,
      marker: {
        templateId: "glow",
        style: { ...TEXT_TEMPLATES.glow.style },
      },
      reveal: {
        templateId: "scrappy",
        style: { ...TEXT_TEMPLATES.scrappy.style },
      },
    },
    "aggregated-board": {
      id: "aggregated-board",
      label: "Aggregated Board",
      aggregated: true,
      marker: {
        templateId: "glow",
        style: { ...TEXT_TEMPLATES.glow.style },
      },
      reveal: {
        templateId: "stamp",
        style: resolveTextTemplateStyle(DEFAULT_TEXT_TEMPLATE_ID),
      },
    },
  };

export const LISTICLE_TEMPLATE_LIST: ListicleTemplate[] =
  LISTICLE_TEMPLATE_IDS.map((id) => LISTICLE_TEMPLATES[id]);

export function resolveListicleTemplate(templateId: string): ListicleTemplate {
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
