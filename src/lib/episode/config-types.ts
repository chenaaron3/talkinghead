import type {
  CaptionStyleOverrides,
} from "../captions/style";

/** Inclusive-exclusive style time range on the source timeline (seconds). */
export type Range = {
  start: number;
  end: number;
};

/** Shared fields for any media file under public/. */
export type MediaBase = {
  /** Path under public/, e.g. `b-roll/glowup/clip.mp4` or `sfx/beep-bop/ding_light.wav` */
  src: string;
  /**
   * Linear gain 0–1.
   * Defaults: video b-roll `0`, SFX `0.4`, music `0.15`. Omit identity in YAML.
   */
  volume?: number;
};

/** Still image — has pixel size, no intrinsic play duration. */
export type ImageAsset = MediaBase & {
  width: number;
  height: number;
};

/** Video file — pixel size + native length. */
export type VideoAsset = MediaBase & {
  width: number;
  height: number;
  srcDurationSec: number;
};

/** Audio file — native length only. */
export type AudioAsset = MediaBase & {
  srcDurationSec: number;
};

export type VisualAsset = ImageAsset | VideoAsset;
export type Asset = VisualAsset | AudioAsset;

/** Source-timeline range (seconds) removed from the output. */
export type SourceCut = Range;

export type SourceListicleItem = {
  id: string;
  markerId: string;
  revealId: string;
};

export type SourceListicle = Range & {
  /** Key into the listicle template catalog. */
  templateId: string;
  items: SourceListicleItem[];
};

export type SourcePunchIn = Range & {
  scale: number;
  /**
   * When true, zoom ramps geometrically per word (root-damped), hard-cut.
   * Default false. Ignores `animate`.
   */
  wordByWord?: boolean;
  /**
   * When true (and not word-by-word), slow-zoom from 1 → scale over the
   * full range, then hard-cut back. When false, hard cut to scale.
   * Default false.
   */
  animate?: boolean;
  /**
   * Zoom focal point as fraction of composition size (0–1).
   * Default 0.5 / 0.35 (face bias). Omit when default.
   */
  originX?: number;
  originY?: number;
};

/**
 * Layout transform shared by overlays (b-roll, captions, text, etc.).
 * Stored fields are optional (omit identity in config.yaml); resolved
 * values always have defaults applied.
 */
export type Transform = {
  /** Uniform scale relative to contain-fit / natural size. Default 1. */
  scale: number;
  /** Offset as fraction of composition size, center-origin. Default 0. */
  offsetX: number;
  offsetY: number;
  /** Rotation in degrees. Default 0. */
  rotation: number;
};

/** Default entrance SFX src for new b-roll placements. */
export const DEFAULT_BROLL_ENTRANCE_SFX = "sfx/realistic/mouse_click.wav";

/** Default entrance SFX for text VFX when `sfx` is omitted. */
export const DEFAULT_TEXT_ENTRANCE_SFX = "sfx/beep-bop/title-enter.wav";

/**
 * Clip that can bake an entrance SFX at its start.
 * Omit / null = silent. Seed defaults only at creation time.
 */
export type HasSFX = {
  sfx?: AudioAsset | null;
};

export type SourceBRoll = {
  id: string;
  /** Video only; seconds into source where playback begins. Default 0. */
  mediaOffsetSec?: number;
  /**
   * Ken Burns end-scale multiplier on `scale` (start).
   * Presence enables the effect; omit when off. Default when enabled: 1.15.
   */
  kenBurns?: number;
  /**
   * When true and episode has a baked cutout, composite under the person plate.
   * Omit / false = normal overlay on top. Default false in YAML.
   */
  behind?: boolean;
} & HasSFX &
  Range &
  VisualAsset &
  Partial<Transform>;

/**
 * Baked person cutout under `public/`.
 * Absent / null = sandwich compositing off.
 *
 * `src` is upright A-roll RGB + Bria alpha (person plate).
 * When present, {@link buildProps} sets `videoSrc` to the sibling
 * `aroll-bg.webm` (room with person punched out) via {@link arollBgSrcForCutout}.
 */
export type SourceCutout = {
  /** Person plate with alpha, e.g. `episodes/day1/cutout.webm` */
  src: string;
  width: number;
  height: number;
  srcDurationSec: number;
  /** A-roll fingerprint used to skip re-bake when unchanged. */
  source: {
    size: number;
    mtimeMs: number;
  };
};

/** Room underlay beside a cutout (`…/cutout.webm` → `…/aroll-bg.webm`). */
export function arollBgSrcForCutout(cutoutSrc: string): string {
  const i = cutoutSrc.lastIndexOf("/");
  const dir = i >= 0 ? cutoutSrc.slice(0, i + 1) : "";
  return `${dir}aroll-bg.webm`;
}

/** Opaque upright RGB used while baking (`…/cutout.webm` → `…/aroll-display.mp4`). */
export function arollDisplaySrcForCutout(cutoutSrc: string): string {
  const i = cutoutSrc.lastIndexOf("/");
  const dir = i >= 0 ? cutoutSrc.slice(0, i + 1) : "";
  return `${dir}aroll-display.mp4`;
}

/**
 * Visual effect kinds. Expand this union as new effects land.
 * `quote` restyles captions for a range (see quote-templates).
 * `text` is a free-text overlay for a range (see text/templates).
 * `listicle-text` is listicle marker/reveal copy — lives in `vfx` but not user-placed.
 */
export const VFX_TYPES = [
  "location",
  "shake",
  "quote",
  "text",
  "listicle-text",
] as const;
export type VfxType = (typeof VFX_TYPES)[number];

/** VFX kinds users can add from the asset palette / VFX track. */
export const USER_PLACEABLE_VFX_TYPES = [
  "location",
  "shake",
  "quote",
  "text",
] as const satisfies readonly VfxType[];
export type UserPlaceableVfxType = (typeof USER_PLACEABLE_VFX_TYPES)[number];

export function isVfxType(value: unknown): value is VfxType {
  return (
    typeof value === "string" &&
    (VFX_TYPES as readonly string[]).includes(value)
  );
}

/** Peak screen offset as a fraction of composition size. */
export const DEFAULT_SHAKE_INTENSITY = 0.014;

type SourceVfxBase = {
  id: string;
} & Range;

/** Baked map overlay — media optional until an address is set. */
export type SourceLocationVfx = SourceVfxBase & {
  type: "location";
  /** Place name for UI. */
  label?: string;
} & Partial<ImageAsset> &
  Partial<Transform>;

/** Camera shake applied to the visual plane for the clip range. */
export type SourceShakeVfx = SourceVfxBase & {
  type: "shake";
  /**
   * Peak offset as fraction of composition size.
   * Default `DEFAULT_SHAKE_INTENSITY`. Omit identity in YAML.
   */
  intensity?: number;
};

/**
 * Caption style highlight — applies a curated Quote look while active.
 * Does not render its own overlay; consumed when building caption groups.
 * `templateId` selects the catalog look; `style` holds user overrides only.
 */
export type SourceQuoteVfx = SourceVfxBase & {
  type: "quote";
  /** Key into the curated Quote template catalog. */
  templateId: string;
  /** User overrides (y / fontSize / captionsAtATime / fill). */
  style?: CaptionStyleOverrides;
};

/**
 * Shared on-screen text fields for `text` and `listicle-text` clips.
 * Entrance SFX seeded at creation ({@link DEFAULT_TEXT_ENTRANCE_SFX}); omit / null = silent.
 */
export type SourceScreenTextVfxFields = {
  /** On-screen copy for this clip. */
  text: string;
  /** Key into the curated Text template catalog. */
  templateId: string;
  /** User overrides (y / fontSize / captionsAtATime / fill). */
  style?: CaptionStyleOverrides;
} & HasSFX;

/**
 * On-screen text overlay for a source range.
 * Owns its own `text`, timing, and look (text templates).
 */
export type SourceTextVfx = SourceVfxBase & {
  type: "text";
} & SourceScreenTextVfxFields;

/** Listicle marker or reveal — same look as text, owned by a listicle item. */
export type SourceListicleTextVfx = SourceVfxBase & {
  type: "listicle-text";
  listicleItemId: string;
  role: "marker" | "reveal";
} & SourceScreenTextVfxFields;

export type SourceScreenTextVfx = SourceTextVfx | SourceListicleTextVfx;

export function isListicleTextVfx(
  clip: SourceVfx,
): clip is SourceListicleTextVfx {
  return clip.type === "listicle-text";
}

export function isScreenTextVfx(clip: SourceVfx): clip is SourceScreenTextVfx {
  return clip.type === "text" || clip.type === "listicle-text";
}

export function isUserPlaceableVfx(
  clip: SourceVfx,
): clip is Exclude<SourceVfx, SourceListicleTextVfx> {
  return clip.type !== "listicle-text";
}

export type SourceVfx =
  | SourceLocationVfx
  | SourceShakeVfx
  | SourceQuoteVfx
  | SourceTextVfx
  | SourceListicleTextVfx;

/**
 * Distribute over `SourceVfx`, keeping members whose declared keys include all of `K`
 * (so `Partial<Transform>` / `Partial<ImageAsset>` intersections are detected).
 */
type SourceVfxHavingKeys<K extends PropertyKey> = SourceVfx extends infer C
  ? C extends SourceVfx
    ? [K] extends [keyof C]
      ? C
      : never
    : never
  : never;

/** VFX clips whose type includes transform fields. */
export type SourceVfxWithTransform = SourceVfxHavingKeys<keyof Transform>;
/** VFX clips whose type includes image media fields. */
export type SourceVfxWithImageAsset = SourceVfxHavingKeys<keyof ImageAsset>;

export type VfxTypeWithTransform = SourceVfxWithTransform["type"];
export type VfxTypeWithImageAsset = SourceVfxWithImageAsset["type"];

type ExhaustiveVfxTypes<
  Actual extends readonly string[],
  Expected extends string,
> = [Exclude<Expected, Actual[number]>] extends [never]
  ? [Exclude<Actual[number], Expected>] extends [never]
    ? true
    : never
  : never;

/**
 * Runtime mirrors of the inferred capability types.
 * When a SourceVfx variant gains/loses Transform or ImageAsset, update these
 * lists — the asserts below will fail until they match.
 */
export const VFX_TYPES_WITH_TRANSFORM = [
  "location",
] as const satisfies readonly VfxTypeWithTransform[];

export const VFX_TYPES_WITH_IMAGE_ASSET = [
  "location",
] as const satisfies readonly VfxTypeWithImageAsset[];

true satisfies ExhaustiveVfxTypes<
  typeof VFX_TYPES_WITH_TRANSFORM,
  VfxTypeWithTransform
>;
true satisfies ExhaustiveVfxTypes<
  typeof VFX_TYPES_WITH_IMAGE_ASSET,
  VfxTypeWithImageAsset
>;

export function vfxSupportsTransform(
  clip: SourceVfx,
): clip is SourceVfxWithTransform {
  return (VFX_TYPES_WITH_TRANSFORM as readonly VfxType[]).includes(clip.type);
}

export function vfxSupportsImageAsset(
  clip: SourceVfx,
): clip is SourceVfxWithImageAsset {
  return (VFX_TYPES_WITH_IMAGE_ASSET as readonly VfxType[]).includes(clip.type);
}
export type SourceSfx = {
  id: string;
} & Range &
  AudioAsset;

/**
 * Single looping music bed for the episode (full output duration).
 * Not a ranged clip — always spans the keep timeline.
 */
export type SourceMusic = {
  id: string;
  /** Seconds into the music file where playback begins. Default 0. */
  mediaOffsetSec?: number;
} & AudioAsset;

/** Episode settings stored in config.yaml (source timeline, seconds). */
export type EpisodeConfig = {
  /**
   * A-roll filename in the episode source directory, e.g. `IMG_1919.MOV`.
   * Other videos in the same folder are treated as b-roll candidates.
   */
  aroll: string;
  /** Null when omitted — process generates via OpenAI and writes config.yaml. */
  title: string | null;
  /** Key into the curated caption template catalog. */
  captionTemplateId: string;
  /**
   * User overrides on the caption template (y / fontSize / captionsAtATime / fill).
   * Quote VFX overrides with a curated template for their range.
   */
  captionStyle?: CaptionStyleOverrides;
  /** Feature flags — whether process runs LLM detection steps. */
  listicle: boolean;
  punchIns: boolean;
  emphasis: boolean;
  /** Source-timeline ranges removed from the output. Keep regions are derived. */
  cuts: SourceCut[];
  listicleOverlay: SourceListicle | null;
  punchInSegments: SourcePunchIn[];
  bRolls: SourceBRoll[];
  vfx: SourceVfx[];
  sfx: SourceSfx[];
  /** One looping bed, or null when unset. */
  music: SourceMusic | null;
  /**
   * SFX `src` baked onto each new b-roll at place time (`SourceBRoll.sfx`).
   * `null` disables. Default: {@link DEFAULT_BROLL_ENTRANCE_SFX}.
   */
  defaultBRollSfx: string | null;
  /**
   * Baked person cutout for behind-person b-roll sandwich.
   * Null when not baked — presence enables compositing.
   */
  cutout: SourceCutout | null;
};
