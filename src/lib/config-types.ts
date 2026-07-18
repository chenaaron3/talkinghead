/** Inclusive-exclusive style time range on the source timeline (seconds). */
export type Range = {
  start: number;
  end: number;
};

/** Shared fields for any media file under public/. */
export type MediaBase = {
  /** Path under public/, e.g. `b-roll/glowup/clip.mp4` or `sfx/ding.wav` */
  src: string;
  /**
   * Linear gain 0–1.
   * Defaults: video b-roll `0`, SFX `0.4`. Omit identity in YAML.
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
  label: string;
  reveal: number;
};

export type SourceListicle = Range & {
  items: SourceListicleItem[];
};

export type SourcePunchIn = Range & {
  scale: number;
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

export type SourceBRoll = {
  id: string;
  /** Video only; seconds into source where playback begins. Default 0. */
  mediaOffsetSec?: number;
} & Range &
  VisualAsset &
  Partial<Transform>;

export type SourceSfx = {
  id: string;
} & Range &
  AudioAsset;

/** Episode settings stored in config.yaml (source timeline, seconds). */
export type EpisodeConfig = {
  /**
   * A-roll filename in the episode source directory, e.g. `IMG_1919.MOV`.
   * Other videos in the same folder are treated as b-roll candidates.
   */
  aroll: string;
  /** Null when omitted — process generates via OpenAI and writes config.yaml. */
  title: string | null;
  titleDurationSec: number;
  captionsAtATime: number;
  /** Feature flags — whether process runs LLM detection steps. */
  listicle: boolean;
  punchIns: boolean;
  emphasis: boolean;
  /** Source-timeline ranges removed from the output. Keep regions are derived. */
  cuts: SourceCut[];
  listicleOverlay: SourceListicle | null;
  punchInSegments: SourcePunchIn[];
  bRolls: SourceBRoll[];
  sfx: SourceSfx[];
};
