export type CaptionEmphasis = "positive" | "negative";

/** One timed token in transcript.json (source timeline, seconds). */
export type TranscriptCaption = {
  text: string;
  start: number;
  end: number;
  emphasis?: CaptionEmphasis;
};

export type Transcript = {
  language: string;
  duration: number;
  captions: TranscriptCaption[];
  source: {
    path: string;
    size: number;
    mtimeMs: number;
  };
};
