export type EpisodeConfig = {
  title: string;
  titleDurationSec: number;
  captionsAtATime: number;
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
  segments: Array<{ start: number; end: number; text: string }>;
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

export type CaptionWord = {
  text: string;
  startSec: number;
  endSec: number;
  startFrame: number;
  endFrame: number;
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
};
