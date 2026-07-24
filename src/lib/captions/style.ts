/** Curated caption font IDs — weight is baked into each entry. */
export const CAPTION_FONT_IDS = [
  "montserrat",
  "pacifico",
  "nunito",
  "inter",
] as const;
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

/** Enter/exit motion applied to words (caption/quote) or the whole group (text). */
export const CAPTION_ANIMATIONS = [
  "none",
  "fade",
  "scale",
  "slide",
  "typewriter",
] as const;
export type CaptionAnimation = (typeof CAPTION_ANIMATIONS)[number];

export function isCaptionAnimation(value: unknown): value is CaptionAnimation {
  return (
    typeof value === "string" &&
    (CAPTION_ANIMATIONS as readonly string[]).includes(value)
  );
}

export const CAPTION_TEXT_TRANSFORMS = [
  "none",
  "uppercase",
  "lowercase",
] as const;
export type CaptionTextTransform = (typeof CAPTION_TEXT_TRANSFORMS)[number];

export function isCaptionTextTransform(
  value: unknown,
): value is CaptionTextTransform {
  return (
    typeof value === "string" &&
    (CAPTION_TEXT_TRANSFORMS as readonly string[]).includes(value)
  );
}

export const BACKGROUND_KINDS = [
  "none",
  "box",
  "wrap",
  "rounded",
  "scrap",
] as const;
export type BackgroundKind = (typeof BACKGROUND_KINDS)[number];

export function isBackgroundKind(value: unknown): value is BackgroundKind {
  return (
    typeof value === "string" &&
    (BACKGROUND_KINDS as readonly string[]).includes(value)
  );
}

/** Shared background chrome for group or word. */
export type BackgroundStyle = {
  kind: BackgroundKind;
  /** Ignored when kind is `none`. */
  color?: string | null;
};

export const CAPTION_FONT_STYLES = ["normal", "italic"] as const;
export type CaptionFontStyle = (typeof CAPTION_FONT_STYLES)[number];

export function isCaptionFontStyle(value: unknown): value is CaptionFontStyle {
  return (
    typeof value === "string" &&
    (CAPTION_FONT_STYLES as readonly string[]).includes(value)
  );
}

export const CAPTION_TEXT_ALIGNS = ["left", "center", "right"] as const;
export type CaptionTextAlign = (typeof CAPTION_TEXT_ALIGNS)[number];

export function isCaptionTextAlign(value: unknown): value is CaptionTextAlign {
  return (
    typeof value === "string" &&
    (CAPTION_TEXT_ALIGNS as readonly string[]).includes(value)
  );
}

export type WordBorder = {
  width: number;
  color: string;
};

/** Paint props for a single word (base or resolved state). */
export type WordStyle = {
  fill: string;
  border?: WordBorder | null;
  background?: BackgroundStyle | null;
  /** Default 1 when omitted. */
  opacity?: number;
  /** CSS text-shadow; null/omit = none. */
  textShadow?: string | null;
};

export type WordStyleDelta = Partial<WordStyle>;

/**
 * Shared caption look for episode defaults, Quote templates, and text VFX.
 * Animation target (per-word vs whole group) is chosen by the parent view
 * ({@link DynamicGroupView} vs {@link StaticGroupView}), not this type.
 */
export type CaptionGroupStyle = {
  fontFamily: CaptionFontId;
  fontSize: number;
  /** Vertical position 0–1 within the safe area (0 = top, 1 = bottom). */
  y: number;
  animation: CaptionAnimation;
  textTransform: CaptionTextTransform;
  captionsAtATime: number;
  background: BackgroundStyle;
  fontStyle: CaptionFontStyle;
  textAlign: CaptionTextAlign;
  /** Base word look — required. */
  wordStyle: WordStyle;
  /** Optional deltas merged onto `wordStyle` for each word state. */
  pastWordStyle?: WordStyleDelta;
  activeWordStyle?: WordStyleDelta;
  futureWordStyle?: WordStyleDelta;
};

/** User-editable overrides persisted with a templateId. */
export type CaptionStyleOverrides = {
  y?: number;
  fontSize?: number;
  captionsAtATime?: number;
  /** Patches `wordStyle.fill`. */
  fill?: string;
};

/** Classic TikTok yellow captions. */
export const DEFAULT_CAPTION_STYLE: CaptionGroupStyle = {
  fontFamily: "montserrat",
  fontSize: 64,
  y: 1,
  animation: "fade",
  textTransform: "uppercase",
  captionsAtATime: 5,
  background: { kind: "none" },
  fontStyle: "normal",
  textAlign: "center",
  wordStyle: {
    fill: "#FFE600",
    border: { width: 10, color: "#000000" },
    opacity: 1,
    textShadow: "0 3px 0 #000, 0 6px 16px rgba(0,0,0,0.85)",
  },
};

/** Shared Y for aesthetic Quote templates — near the text VFX band. */
export const QUOTE_CAPTION_Y = 0.08;

/** Bottom of safe area — default / caption templates. */
export const TRENDING_CAPTION_Y = 1;

/** Default enter/exit window used for short-duration hard-skip. */
export const CAPTION_ENTER_SEC = 0.18;

/** Word-state blend duration (future → active → past). */
export const WORD_STATE_BLEND_SEC = 0.08;

/** Group-scope typewriter delay between characters. */
export const TYPEWRITER_CHAR_DELAY_SEC = 0.01;

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

export function mergeWordStyle(
  base: WordStyle,
  delta?: WordStyleDelta | null,
): WordStyle {
  if (!delta) return { ...base };
  return {
    fill: delta.fill ?? base.fill,
    border: "border" in delta ? delta.border : base.border,
    background: "background" in delta ? delta.background : base.background,
    opacity: delta.opacity ?? base.opacity,
    textShadow: "textShadow" in delta ? delta.textShadow : base.textShadow,
  };
}

/** Apply persisted overrides onto a resolved template style. */
export function applyCaptionOverrides(
  style: CaptionGroupStyle,
  overrides?: CaptionStyleOverrides | null,
): CaptionGroupStyle {
  if (!overrides) return style;
  return {
    ...style,
    y: overrides.y != null ? clampCaptionY(overrides.y) : style.y,
    fontSize:
      overrides.fontSize != null &&
      Number.isFinite(overrides.fontSize) &&
      overrides.fontSize > 0
        ? overrides.fontSize
        : style.fontSize,
    captionsAtATime:
      overrides.captionsAtATime != null
        ? clampCaptionsAtATime(overrides.captionsAtATime)
        : style.captionsAtATime,
    wordStyle: {
      ...style.wordStyle,
      fill: overrides.fill?.trim() || style.wordStyle.fill,
    },
  };
}

/** Extract editable overrides from a full style (vs template defaults). */
export function captionStyleOverridesFrom(
  style: CaptionGroupStyle,
  template: CaptionGroupStyle,
): CaptionStyleOverrides {
  const out: CaptionStyleOverrides = {};
  if (style.y !== template.y) out.y = style.y;
  if (style.fontSize !== template.fontSize) out.fontSize = style.fontSize;
  if (style.captionsAtATime !== template.captionsAtATime) {
    out.captionsAtATime = style.captionsAtATime;
  }
  if (style.wordStyle.fill !== template.wordStyle.fill) {
    out.fill = style.wordStyle.fill;
  }
  return out;
}
