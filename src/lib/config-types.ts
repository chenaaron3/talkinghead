/** Source-timeline range (seconds) removed from the output. */
export type SourceCut = {
  start: number;
  end: number;
};

export type SourceListicleItem = {
  label: string;
  reveal: number;
};

export type SourceListicle = {
  start: number;
  end: number;
  items: SourceListicleItem[];
};

export type SourcePunchIn = {
  start: number;
  end: number;
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
  /** Path under public/, e.g. `b-roll/glowup/Perm_Before.jpg` */
  src: string;
  start: number;
  end: number;
} & Partial<Transform>;


export type SourceSfx = {
  id: string;
  /** Path under public/, e.g. `sfx/ding_light.wav` */
  src: string;
  start: number;
  end: number;
  /** Native length of the audio file (seconds); play duration cannot exceed this. */
  srcDurationSec: number;
};

/** Episode settings stored in config.yaml (source timeline, seconds). */
export type EpisodeConfig = {
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
