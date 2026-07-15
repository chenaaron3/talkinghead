import type {
  SourceBRoll,
  SourceCut,
  SourcePunchIn,
  SourceSfx,
  TranscriptCaption,
} from "@src/lib/types";

/** Stable fallbacks for zustand selectors — never use `?? []` inline. */
export const EMPTY_CUTS: SourceCut[] = [];
export const EMPTY_BROLLS: SourceBRoll[] = [];
export const EMPTY_SFX: SourceSfx[] = [];
export const EMPTY_PUNCH_INS: SourcePunchIn[] = [];
export const EMPTY_CAPTIONS: TranscriptCaption[] = [];
