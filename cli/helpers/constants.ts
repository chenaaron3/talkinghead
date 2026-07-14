/** Hardcoded editing / transcription defaults (not configurable). */

/** whispermlx ASR model (MLX on Apple Silicon) */
export const WHISPER_MODEL = "large-v3-turbo" as const;
/** Whisper language code */
export const WHISPER_LANGUAGE = "en" as const;

/** Silence longer than this (seconds) is cut */
export const GAP_THRESHOLD_SEC = 0.5;
/** Extra audio kept around filler cuts so consonants aren't clipped */
export const FILLER_PADDING_SEC = 0.5;
/** Title/caption fade in/out duration (seconds) */
export const FADE_DURATION_SEC = 0.15;

/** Tokens removed from the edit (case-insensitive) */
export const FILLER_WORDS = [
  "um",
  "uh",
  "uhm",
  "uhh",
  "er",
  "ah",
  "hmm",
  "mm",
  "mhm",
] as const;

/** Fallback when titleDurationSec is omitted from config */
export const DEFAULT_TITLE_DURATION_SEC = 5;
/** Fallback when captionsAtATime is omitted from config */
export const DEFAULT_CAPTIONS_AT_A_TIME = 1;
