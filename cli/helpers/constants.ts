/** Hardcoded editing / transcription defaults (not configurable). */

/** whispermlx ASR model (MLX on Apple Silicon) */
export const WHISPER_MODEL = "large-v3-turbo" as const;
/** Whisper language code */
export const WHISPER_LANGUAGE = "en" as const;

export {
  FILLER_PADDING_SEC,
  PROCESS_GAP_THRESHOLD_SEC,
  SCISSOR_GAP_THRESHOLD_SEC,
  SCISSOR_MARGIN_SEC,
  WORD_MARGIN_SEC,
} from "../../src/lib/timeline/editing-constants";
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

/** Duration used only when seeding the initial text VFX (`0 → end`). */
export const DEFAULT_TEXT_VFX_DURATION_SEC = 5;
