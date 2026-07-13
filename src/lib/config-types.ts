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

export type SourceBRoll = {
  id: string;
  /** Path under public/, e.g. `b-roll/glowup/Perm_Before.jpg` */
  src: string;
  start: number;
  end: number;
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
};
