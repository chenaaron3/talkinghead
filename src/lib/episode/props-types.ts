import type { CaptionStyle } from "../captions/style";
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
  /**
   * Resolved style for this group (default or Quote template).
   * Optional for older generated props.json — renderer falls back to default.
   */
  style?: CaptionStyle;
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
  /** Default false when omitted (older generated props). Hard-cut steps; ignores animate. */
  wordByWord?: boolean;
  /** Default false when omitted. Slow 1→scale over full range (non–word-by-word only). */
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
  /** End-scale multiplier on `scale`; presence enables Ken Burns. */
  kenBurns?: number;
  /** Under person cutout when cutoutSrc is set. Default false. */
  behind?: boolean;
} & Partial<Transform>;

type VfxClipBase = {
  id: string;
  startFrame: number;
  endFrame: number;
};

/** Location map overlay — only present once media is baked. */
export type LocationVfxClip = VfxClipBase & {
  type: "location";
  src: string;
  width: number;
  height: number;
} & Partial<Transform>;

/** Screen shake for the clip range. */
export type ShakeVfxClip = VfxClipBase & {
  type: "shake";
  /** Peak offset as fraction of composition size. */
  intensity: number;
};

export type VfxClip = LocationVfxClip | ShakeVfxClip;

export type SfxClip = {
  id: string;
  /** Path under public/, e.g. `sfx/beep-bop/ding_light.wav` */
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
  /**
   * Person plate with alpha (original A-roll RGB + Bria matte).
   * When set, `videoSrc` is the sibling room plate (`aroll-bg.webm`).
   */
  cutoutSrc?: string | null;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  titleDurationSec: number;
  /** Omit on older generated props — renderer falls back to stamp default. */
  titleStyle?: CaptionStyle;
  sections: OutputSection[];
  captionGroups: CaptionGroup[];
  listicle: ListicleOverlay | null;
  punchIns?: PunchInSegment[] | null;
  bRolls?: BRollClip[] | null;
  vfx?: VfxClip[] | null;
  sfx?: SfxClip[] | null;
  music?: MusicClip | null;
};
