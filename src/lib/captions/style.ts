/** Curated caption font IDs — weight is baked into each entry. */
export const CAPTION_FONT_IDS = ["montserrat", "pacifico", "nunito", "inter"] as const;
export type CaptionFontId = (typeof CAPTION_FONT_IDS)[number];

export function isCaptionFontId(value: unknown): value is CaptionFontId {
  return (
    typeof value === "string" &&
    (CAPTION_FONT_IDS as readonly string[]).includes(value)
  );
}

export type CaptionFontFace = {
  id: CaptionFontId;
  /** CSS font-family stack. */
  family: string;
  weight: number;
};

export const CAPTION_FONTS: Record<CaptionFontId, CaptionFontFace> = {
  montserrat: {
    id: "montserrat",
    family: '"Montserrat", "Arial Black", Impact, sans-serif',
    weight: 900,
  },
  pacifico: {
    id: "pacifico",
    family: '"Pacifico", "Segoe Script", cursive',
    weight: 400,
  },
  nunito: {
    id: "nunito",
    family: '"Nunito", "Arial Rounded MT Bold", sans-serif',
    weight: 800,
  },
  inter: {
    id: "inter",
    family: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
    weight: 700,
  },
};

export const CAPTION_ANIMATIONS = [
  "fade",
  "typewriter",
  "none",
  "pop",
  "karaoke",
] as const;
export type CaptionAnimation = (typeof CAPTION_ANIMATIONS)[number];

export function isCaptionAnimation(value: unknown): value is CaptionAnimation {
  return (
    typeof value === "string" &&
    (CAPTION_ANIMATIONS as readonly string[]).includes(value)
  );
}

export const CAPTION_TEXT_TRANSFORMS = ["none", "uppercase", "lowercase"] as const;
export type CaptionTextTransform = (typeof CAPTION_TEXT_TRANSFORMS)[number];

export function isCaptionTextTransform(
  value: unknown,
): value is CaptionTextTransform {
  return (
    typeof value === "string" &&
    (CAPTION_TEXT_TRANSFORMS as readonly string[]).includes(value)
  );
}

export type CaptionStroke = {
  width: number;
  color: string;
};

export const CAPTION_BACKDROPS = ["none", "box", "pill", "scrap"] as const;
export type CaptionBackdrop = (typeof CAPTION_BACKDROPS)[number];

export function isCaptionBackdrop(value: unknown): value is CaptionBackdrop {
  return (
    typeof value === "string" &&
    (CAPTION_BACKDROPS as readonly string[]).includes(value)
  );
}

export const CAPTION_FONT_STYLES = ["normal", "italic"] as const;
export type CaptionFontStyle = (typeof CAPTION_FONT_STYLES)[number];

export function isCaptionFontStyle(value: unknown): value is CaptionFontStyle {
  return (
    typeof value === "string" &&
    (CAPTION_FONT_STYLES as readonly string[]).includes(value)
  );
}

export const CAPTION_TEXT_ALIGNS = ["left", "center"] as const;
export type CaptionTextAlign = (typeof CAPTION_TEXT_ALIGNS)[number];

export function isCaptionTextAlign(value: unknown): value is CaptionTextAlign {
  return (
    typeof value === "string" &&
    (CAPTION_TEXT_ALIGNS as readonly string[]).includes(value)
  );
}

/** Shared caption look for episode defaults, Quote templates, and text VFX. */
export type CaptionStyle = {
  fontFamily: CaptionFontId;
  fontSize: number;
  color: string;
  /** Vertical position 0–1 within the safe area (0 = top, 1 = bottom). */
  y: number;
  animation: CaptionAnimation;
  stroke: CaptionStroke | null;
  shadow: boolean;
  textTransform: CaptionTextTransform;
  captionsAtATime: number;
  /**
   * Split the group into two lines (first half / second half).
   * Top line left-aligned; bottom line right-aligned.
   */
  stack?: boolean;
  /** none | solid box behind group | rounded pill per word | torn scrap per word. */
  backdrop?: CaptionBackdrop;
  /** CSS font-style. Default normal. */
  fontStyle?: CaptionFontStyle;
  /** Horizontal align for non-stack layouts / text VFX. Default center. */
  textAlign?: CaptionTextAlign;
  /**
   * Fill color when `backdrop` is `box` (text VFX uses yellow/white boards).
   * Captions default to translucent black when omitted.
   */
  backdropColor?: string | null;
  /**
   * When `backdrop` is `box`, paint a per-line hugging silhouette (white board)
   * instead of a single rectangular stamp.
   */
  contourBoard?: boolean;
  /** Custom CSS text-shadow; overrides the boolean `shadow` when set. */
  textShadow?: string | null;
};

/** Matches the historic hard-coded TikTok yellow captions. */
export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontFamily: "montserrat",
  fontSize: 64,
  color: "#FFE600",
  y: 1,
  animation: "fade",
  stroke: { width: 10, color: "#000000" },
  shadow: true,
  textTransform: "uppercase",
  captionsAtATime: 5,
  stack: false,
  backdrop: "none",
  fontStyle: "normal",
  textAlign: "center",
  backdropColor: null,
  contourBoard: false,
};

/** Shared Y for aesthetic Quote templates — near the text VFX band. */
export const QUOTE_CAPTION_Y = 0.08;

/** Bottom of safe area — default / caption templates. */
export const TRENDING_CAPTION_Y = 1;

/** Default karaoke highlight (Hormozi yellow). */
export const DEFAULT_HIGHLIGHT_COLOR = "#FFE600";

export function resolveCaptionFont(id: CaptionFontId): CaptionFontFace {
  return CAPTION_FONTS[id];
}

export function clampCaptionY(y: number): number {
  if (!Number.isFinite(y)) return DEFAULT_CAPTION_STYLE.y;
  return Math.min(1, Math.max(0, y));
}

export function clampCaptionsAtATime(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_CAPTION_STYLE.captionsAtATime;
  return Math.min(8, Math.max(1, Math.round(n)));
}
