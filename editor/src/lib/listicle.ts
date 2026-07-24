import { normalizeCaptionStyle } from "@src/lib/captions/parse-style";
import type {
  EpisodeConfig,
  SourceListicle,
  SourceListicleItem,
  SourceListicleTextVfx,
} from "@src/lib/types";
import {
  DEFAULT_LISTICLE_TEMPLATE_ID,
  LISTICLE_TEMPLATES,
  isListicleTemplateId,
  resolveListicleTemplate,
  type ListicleTemplateId,
} from "@src/lib/listicle/templates";
import { isSelected } from "./selection";
import type { Selection } from "./selection";

export type ResolvedListicleItem = {
  item: SourceListicleItem;
  index: number;
  marker: SourceListicleTextVfx;
  reveal: SourceListicleTextVfx;
};

export function resolveListicleItems(
  config: EpisodeConfig | null | undefined,
): ResolvedListicleItem[] {
  const overlay = config?.listicleOverlay;
  if (!overlay) return [];
  const byId = new Map((config?.vfx ?? []).map((clip) => [clip.id, clip]));
  const resolved: ResolvedListicleItem[] = [];
  overlay.items.forEach((item, index) => {
    const marker = byId.get(item.markerId);
    const reveal = byId.get(item.revealId);
    if (marker?.type !== "listicle-text" || reveal?.type !== "listicle-text") {
      return;
    }
    resolved.push({ item, index, marker, reveal });
  });
  return resolved;
}

export function findListicleTextVfx(
  config: EpisodeConfig | null | undefined,
  id: string,
): { clip: SourceListicleTextVfx; itemIndex: number; role: "marker" | "reveal" } | null {
  const clip = (config?.vfx ?? []).find(
    (c): c is SourceListicleTextVfx =>
      c.id === id && c.type === "listicle-text",
  );
  if (!clip || !config?.listicleOverlay) return null;
  const itemIndex = config.listicleOverlay.items.findIndex(
    (item) => item.id === clip.listicleItemId,
  );
  if (itemIndex < 0) return null;
  return { clip, itemIndex, role: clip.role };
}

/** Item index when this word is in a listicle marker or reveal range. */
export function listicleRangeItemIndexFromAnnotation(annotation: {
  listicleMarkerRange?: { itemIndex: number };
  listicleRevealRange?: { itemIndex: number };
}): number | null {
  return (
    annotation.listicleMarkerRange?.itemIndex ??
    annotation.listicleRevealRange?.itemIndex ??
    null
  );
}

/** Resolve the listicle item index for transcript/timeline hit targets. */
export function listicleItemIndexFromAnnotation(annotation: {
  listicleItemIndex?: number;
  listicleMarkerRange?: { itemIndex: number };
  listicleRevealRange?: { itemIndex: number };
}): number | null {
  return (
    listicleRangeItemIndexFromAnnotation(annotation) ??
    annotation.listicleItemIndex ??
    null
  );
}

export function listicleTextVfxIdFromAnnotation(annotation: {
  listicleMarkerRange?: { id: string };
  listicleRevealRange?: { id: string };
}): string | null {
  return (
    annotation.listicleRevealRange?.id ??
    annotation.listicleMarkerRange?.id ??
    null
  );
}

/** Item is active when selected directly or via one of its listicle-text clips. */
export function isListicleItemActive(
  selection: Selection | null,
  config: EpisodeConfig | null | undefined,
  itemIndex: number,
): boolean {
  if (isSelected(selection, "listicleItem", itemIndex)) return true;
  if (selection?.kind !== "vfx" || !config) return false;
  const id = selection.ids[0];
  if (typeof id !== "string") return false;
  const ref = findListicleTextVfx(config, id);
  return ref?.itemIndex === itemIndex;
}

export function withListicleTemplate(
  config: EpisodeConfig,
  templateId: ListicleTemplateId,
): EpisodeConfig {
  const overlay = config.listicleOverlay;
  if (!overlay) return config;
  const template = LISTICLE_TEMPLATES[templateId];
  const vfx = (config.vfx ?? []).map((clip) => {
    if (clip.type !== "listicle-text") return clip;
    const item = overlay.items.find((entry) => entry.id === clip.listicleItemId);
    if (!item) return clip;
    const defaults = clip.role === "marker" ? template.marker : template.reveal;
    return {
      ...clip,
      templateId: defaults.templateId,
      style: normalizeCaptionStyle(undefined, defaults.style),
    };
  });
  return {
    ...config,
    listicleOverlay: { ...overlay, templateId },
    vfx,
  };
}

export function resolveListicleOverlayTemplateId(
  overlay: SourceListicle,
): ListicleTemplateId {
  const raw = overlay.templateId?.trim();
  if (raw && isListicleTemplateId(raw)) return raw;
  return DEFAULT_LISTICLE_TEMPLATE_ID;
}

export function listicleItemLabel(
  config: EpisodeConfig | null | undefined,
  item: SourceListicleItem,
): string {
  const reveal = (config?.vfx ?? []).find(
    (c): c is SourceListicleTextVfx =>
      c.id === item.revealId && c.type === "listicle-text",
  );
  return reveal?.text ?? "";
}

export function listicleAggregated(overlay: SourceListicle): boolean {
  return resolveListicleTemplate(overlay.templateId).aggregated;
}

export {
  LISTICLE_TEMPLATE_LIST,
  LISTICLE_TEMPLATES,
  resolveListicleTemplate,
  type ListicleTemplateId,
} from "@src/lib/listicle/templates";
