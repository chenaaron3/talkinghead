import type { CaptionEmphasis } from "./transcript-types";
import type { Transform } from "./config-types";

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
  /** Default false when omitted (older generated props). */
  wordByWord?: boolean;
  /** Default true when omitted (older generated props). */
  animate?: boolean;
  /** Output-frame starts for each word when `wordByWord` is true. */
  wordStartFrames?: number[];
  /** Zoom focal point as fraction of composition size (0–1). */
  originX?: number;
  originY?: number;
};

export type BRollClip = {
  id: string;
  /** Path under public/, e.g. `b-roll/glowup/Perm_Before.jpg` */
  src: string;
  /** Native pixel size of the media file. */
  width: number;
  height: number;
  startFrame: number;
  endFrame: number;
  /** Video only; seconds into source. Default 0. */
  mediaOffsetSec?: number;
  /** Video only; 0–1. Default 0 (muted). */
  volume?: number;
} & Partial<Transform>;

export type SfxClip = {
  id: string;
  /** Path under public/, e.g. `sfx/ding_light.wav` */
  src: string;
  startFrame: number;
  endFrame: number;
  /** 0–1. Default 0.4. */
  volume?: number;
};

export type MusicClip = {
  id: string;
  /** Path under public/, e.g. `music/Lofi1.mp3` */
  src: string;
  srcDurationSec: number;
  /** 0–1. Default MUSIC_VOLUME_DEFAULT. */
  volume?: number;
  /** Seconds into the music file. Default 0. */
  mediaOffsetSec?: number;
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
  sfx?: SfxClip[] | null;
  music?: MusicClip | null;
};
