import { MapPin, Quote, Vibrate, type LucideIcon } from "lucide-react";
import type {
  ImageAsset,
  SourceLocationVfx,
  SourceQuoteVfx,
  SourceShakeVfx,
  SourceVfx,
  SourceVfxWithImageAsset,
  SourceVfxWithTransform,
  Transform,
  VfxType,
} from "@src/lib/types";
import {
  DEFAULT_SHAKE_INTENSITY,
  VFX_TYPES,
  vfxSupportsImageAsset,
  vfxSupportsTransform,
} from "@src/lib/episode/config-types";
import type { CaptionStyle } from "@src/lib/captions/style";
import {
  DEFAULT_QUOTE_TEMPLATE_ID,
  QUOTE_TEMPLATES,
  isQuoteTemplateId,
  resolveQuoteTemplateStyle,
  type QuoteTemplateId,
} from "@src/lib/captions/quote-templates";
import { normalizeCaptionStyle } from "@src/lib/captions/parse-style";

import {
  BROLL_SCALE_MAX,
  BROLL_SCALE_MIN,
  TRANSFORM_DEFAULTS,
  clampBRollScale,
  resolveTransform,
} from "./broll";
import { MIN_RANGE_SEC } from "./range";

export {
  BROLL_SCALE_MAX,
  BROLL_SCALE_MIN,
  TRANSFORM_DEFAULTS,
  resolveTransform,
  clampBRollScale,
  DEFAULT_SHAKE_INTENSITY,
  vfxSupportsImageAsset,
  vfxSupportsTransform,
};
export type { Transform, SourceVfxWithImageAsset, SourceVfxWithTransform };

/** Display metadata for each VFX kind (label + icon). */
export type VfxMeta = {
  label: string;
  Icon: LucideIcon;
};

export const VFX_META: Record<VfxType, VfxMeta> = {
  location: { label: "Location", Icon: MapPin },
  shake: { label: "Shake", Icon: Vibrate },
  quote: { label: "Quote", Icon: Quote },
};

export type VfxPreset = {
  type: VfxType;
  label: string;
};

/** Drag payloads from the VFX tab (presets, not baked files). */
export const VFX_PRESETS: VfxPreset[] = VFX_TYPES.map((type) => ({
  type,
  label: VFX_META[type].label,
}));

/** Type-level display label (e.g. inspector title). */
export function vfxTypeLabel(type: VfxType): string {
  return VFX_META[type].label;
}

/** Clip label for badges/track — custom label when set, else type label. */
export function vfxClipLabel(clip: SourceVfx): string {
  if (clip.type === "quote") {
    const id = resolveQuoteTemplateId(clip);
    return QUOTE_TEMPLATES[id]?.label ?? VFX_META.quote.label;
  }
  if ("label" in clip && clip.label) return clip.label;
  return VFX_META[clip.type].label;
}

export function isLocationVfx(clip: SourceVfx): clip is SourceLocationVfx {
  return clip.type === "location";
}

export function isShakeVfx(clip: SourceVfx): clip is SourceShakeVfx {
  return clip.type === "shake";
}

export function isQuoteVfx(clip: SourceVfx): clip is SourceQuoteVfx {
  return clip.type === "quote";
}

/** True when image media is fully present (baked). */
export function vfxHasMedia(
  clip: SourceVfx,
): clip is SourceVfxWithImageAsset & ImageAsset {
  return (
    vfxSupportsImageAsset(clip) &&
    Boolean(
      clip.src &&
        clip.width != null &&
        clip.width > 0 &&
        clip.height != null &&
        clip.height > 0,
    )
  );
}

export function resolveShakeIntensity(clip: SourceShakeVfx): number {
  return clip.intensity ?? DEFAULT_SHAKE_INTENSITY;
}

export function resolveQuoteTemplateId(clip: SourceQuoteVfx): QuoteTemplateId {
  return isQuoteTemplateId(clip.templateId)
    ? clip.templateId
    : DEFAULT_QUOTE_TEMPLATE_ID;
}

/** Resolved editable style on a Quote clip (falls back to template). */
export function resolveQuoteStyle(clip: SourceQuoteVfx): CaptionStyle {
  if (clip.style) {
    return normalizeCaptionStyle(
      clip.style,
      resolveQuoteTemplateStyle(resolveQuoteTemplateId(clip)),
    );
  }
  return resolveQuoteTemplateStyle(resolveQuoteTemplateId(clip));
}

function rangesOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Write only non-default fields (omit identity in config.yaml). */
export function compactVfx(clip: SourceVfx): SourceVfx {
  if (clip.type === "shake") {
    const out: SourceShakeVfx = {
      id: clip.id,
      type: "shake",
      start: clip.start,
      end: clip.end,
    };
    const intensity = resolveShakeIntensity(clip);
    if (intensity !== DEFAULT_SHAKE_INTENSITY) {
      out.intensity = intensity;
    }
    return out;
  }

  if (clip.type === "quote") {
    const templateId = resolveQuoteTemplateId(clip);
    return {
      id: clip.id,
      type: "quote",
      start: clip.start,
      end: clip.end,
      templateId,
      style: resolveQuoteStyle(clip),
    };
  }

  const next = resolveTransform(clip);
  const out: SourceLocationVfx = {
    id: clip.id,
    type: "location",
    start: clip.start,
    end: clip.end,
  };
  if (clip.label) out.label = clip.label;
  if (vfxHasMedia(clip)) {
    out.src = clip.src;
    out.width = clip.width;
    out.height = clip.height;
  }
  if (next.scale !== TRANSFORM_DEFAULTS.scale) out.scale = next.scale;
  if (next.offsetX !== TRANSFORM_DEFAULTS.offsetX) {
    out.offsetX = next.offsetX;
  }
  if (next.offsetY !== TRANSFORM_DEFAULTS.offsetY) {
    out.offsetY = next.offsetY;
  }
  if (next.rotation !== TRANSFORM_DEFAULTS.rotation) {
    out.rotation = next.rotation;
  }
  return out;
}

export function withVfxTransform(
  clip: SourceVfx,
  patch: Partial<Transform>,
): SourceVfx {
  if (!vfxSupportsTransform(clip)) return clip;
  const next = resolveTransform(clip);
  if (patch.scale != null) next.scale = clampBRollScale(patch.scale);
  if (patch.offsetX != null) next.offsetX = patch.offsetX;
  if (patch.offsetY != null) next.offsetY = patch.offsetY;
  if (patch.rotation != null) next.rotation = patch.rotation;
  return compactVfx({ ...clip, ...next });
}

export function withVfxMedia(
  clip: SourceVfx,
  media: {
    src: string;
    width: number;
    height: number;
    label?: string;
  },
): SourceVfx {
  if (!vfxSupportsImageAsset(clip)) return clip;
  return compactVfx({
    ...clip,
    src: media.src,
    width: media.width,
    height: media.height,
    ...(media.label ? { label: media.label } : {}),
  });
}

export function withVfxIntensity(
  clip: SourceVfx,
  intensity: number,
): SourceVfx {
  if (!isShakeVfx(clip)) return clip;
  const clamped = Math.min(0.08, Math.max(0.002, intensity));
  return compactVfx({ ...clip, intensity: clamped });
}

export function withQuoteTemplate(
  clip: SourceVfx,
  templateId: QuoteTemplateId,
): SourceVfx {
  if (!isQuoteVfx(clip)) return clip;
  return compactVfx({
    ...clip,
    templateId,
    style: { ...resolveQuoteTemplateStyle(templateId) },
  });
}

export function withQuoteStyle(
  clip: SourceVfx,
  patch: Partial<CaptionStyle>,
): SourceVfx {
  if (!isQuoteVfx(clip)) return clip;
  const style = normalizeCaptionStyle(
    { ...resolveQuoteStyle(clip), ...patch },
    resolveQuoteStyle(clip),
  );
  return compactVfx({ ...clip, style });
}

export function createVfxFromPreset(
  preset: VfxPreset,
  range: { start: number; end: number },
  id: string,
): SourceVfx {
  if (preset.type === "shake") {
    return {
      id,
      type: "shake",
      start: range.start,
      end: range.end,
    };
  }
  if (preset.type === "quote") {
    return {
      id,
      type: "quote",
      start: range.start,
      end: range.end,
      templateId: DEFAULT_QUOTE_TEMPLATE_ID,
      style: { ...resolveQuoteTemplateStyle(DEFAULT_QUOTE_TEMPLATE_ID) },
    };
  }
  return {
    id,
    type: "location",
    label: preset.label,
    start: range.start,
    end: range.end,
  };
}

export function upsertVfx(
  clips: SourceVfx[],
  clip: SourceVfx,
): SourceVfx[] | { error: string } {
  const others = clips.filter((c) => c.id !== clip.id);
  if (clip.end <= clip.start) {
    return { error: "VFX end must be after start" };
  }
  if (clip.end - clip.start < MIN_RANGE_SEC) {
    return { error: "VFX range too short" };
  }
  if (clip.type === "quote") {
    const overlap = others.find(
      (c) => c.type === "quote" && rangesOverlap(c, clip),
    );
    if (overlap) {
      return { error: "Quote VFX ranges cannot overlap" };
    }
  }
  return [...others, compactVfx(clip)].sort((a, b) => a.start - b.start);
}

export function removeVfx(clips: SourceVfx[], id: string): SourceVfx[] {
  return clips.filter((c) => c.id !== id);
}

export function isVfxActiveAt(
  clip: Pick<SourceVfx, "start" | "end">,
  sourceSec: number,
): boolean {
  return sourceSec >= clip.start && sourceSec < clip.end;
}
