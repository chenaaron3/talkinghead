/** Source-timeline range (seconds) kept even when silent — e.g. on-camera holds. */
export type HoldRange = {
  start: number;
  end: number;
};

export type EpisodeConfig = {
  /** Null when omitted — process generates via OpenAI and writes config.yaml. */
  title: string | null;
  titleDurationSec: number;
  captionsAtATime: number;
  listicle: boolean;
  punchIns: boolean;
  emphasis: boolean;
  /** Silence inside these source ranges is not cut. */
  holds: HoldRange[];
};

export type ListicleItem = {
  label: string;
  revealFrame: number;
};

export type ListicleOverlay = {
  startFrame: number;
  endFrame: number;
  items: ListicleItem[];
};

export type PunchInSegment = {
  startFrame: number;
  endFrame: number;
  scale: number;
};

export type BRollClip = {
  id: string;
  /** Path under public/, e.g. `b-roll/glowup/Perm_Before.jpg` */
  src: string;
  startFrame: number;
  endFrame: number;
};

export type TranscriptWord = {
  word: string;
  start: number;
  end: number;
  probability: number | null;
};

export type Transcript = {
  language: string;
  duration: number;
  words: TranscriptWord[];
  source: {
    path: string;
    size: number;
    mtimeMs: number;
  };
};

export type KeepSegment = {
  startSec: number;
  endSec: number;
  outputStartSec: number;
  outputEndSec: number;
  trimBefore: number;
  trimAfter: number;
  durationInFrames: number;
};

export type CaptionEmphasis = "positive" | "negative";

export type CaptionWord = {
  text: string;
  startSec: number;
  endSec: number;
  startFrame: number;
  endFrame: number;
  emphasis?: CaptionEmphasis;
};

export type CaptionGroup = {
  words: CaptionWord[];
  startFrame: number;
  endFrame: number;
};

export type EpisodeProps = {
  episodeId: string;
  title: string;
  videoSrc: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  titleDurationSec: number;
  captionsAtATime: number;
  sections: Array<{
    trimBefore: number;
    trimAfter: number;
    durationInFrames: number;
  }>;
  captionGroups: CaptionGroup[];
  listicle: ListicleOverlay | null;
  /** Optional: cached props.json files from before this feature lack the field. */
  punchIns?: PunchInSegment[] | null;
  /** Optional: image overlays on the output timeline. */
  bRolls?: BRollClip[] | null;
};
