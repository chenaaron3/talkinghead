export const FADE_DURATION_SEC = 0.15;
/** Word caption fade in/out — keep snappy so words pop on beat. */
export const CAPTION_FADE_DURATION_SEC = 0.08;
/** Hold the last word in a group a bit longer when the next group starts later. */
export const CAPTION_LAST_WORD_PAD_SEC = 0.3;
/** Minimum gap before the next caption group begins. */
export const CAPTION_GROUP_GAP_SEC = 0.05;

/** Output composition size (9:16 TikTok / Reels / Shorts). */
export const COMPOSITION_WIDTH = 1080;
export const COMPOSITION_HEIGHT = 1920;

/** 9:16 UI chrome margins shared across TikTok / Reels / Shorts. */
export const SAFE_AREA = {
  top: "12%",
  bottom: "22%",
  left: "18%",
  right: "18%",
} as const;
