import { MapPin, Vibrate, type LucideIcon } from "lucide-react";
import type {
  ImageAsset,
  SourceLocationVfx,
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
} from "@src/lib/config-types";

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
  if ("label" in clip && clip.label) return clip.label;
  return VFX_META[clip.type].label;
}

export function isLocationVfx(clip: SourceVfx): clip is SourceLocationVfx {
  return clip.type === "location";
}

export function isShakeVfx(clip: SourceVfx): clip is SourceShakeVfx {
  return clip.type === "shake";
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
