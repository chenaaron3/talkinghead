import type { CaptionEmphasis } from "./transcript-types";

export type OutputSection = {
  trimBefore: number;
  trimAfter: number;
  durationInFrames: number;
};

export type CaptionWord = {
  text: string;
  startFrame: number;
  endFrame: number;
  emphasis?: CaptionEmphasis;
};

export type CaptionGroup = {
  words: CaptionWord[];
  startFrame: number;
  endFrame: number;
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

/** Derived render payload stored in props.json (output timeline, frames). */
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
  sections: OutputSection[];
  captionGroups: CaptionGroup[];
  listicle: ListicleOverlay | null;
  punchIns?: PunchInSegment[] | null;
  bRolls?: BRollClip[] | null;
};
