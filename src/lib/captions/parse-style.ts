import {
  DEFAULT_CAPTION_STYLE,
  clampCaptionY,
  clampCaptionsAtATime,
  isBackgroundKind,
  isCaptionAnimation,
  isCaptionFontId,
  isCaptionFontStyle,
  isCaptionTextAlign,
  isCaptionTextTransform,
  type BackgroundStyle,
  type CaptionGroupStyle,
  type CaptionStyleOverrides,
  type WordBorder,
  type WordStyle,
  type WordStyleDelta,
} from "./style";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBorder(value: unknown): WordBorder | null {
  if (value == null) return null;
  if (!isPlainObject(value)) return null;
  const width = Number(value.width);
  const color = String(value.color ?? "").trim();
  if (!Number.isFinite(width) || width <= 0 || !color) return null;
  return { width, color };
}

function parseBackground(
  value: unknown,
  fallback: BackgroundStyle,
): BackgroundStyle {
  if (!isPlainObject(value)) return { ...fallback };
  const kind = isBackgroundKind(value.kind) ? value.kind : fallback.kind;
  let color: string | null | undefined;
  if ("color" in value) {
    const raw = value.color;
    if (raw == null || raw === "") color = null;
    else {
      const trimmed = String(raw).trim();
      color = trimmed || null;
    }
  } else {
    color = fallback.color;
  }
  return { kind, color };
}

function parseOptionalString(
  src: Record<string, unknown>,
  key: string,
  fallback: string | null | undefined,
): string | null | undefined {
  if (!(key in src)) return fallback;
  const raw = src[key];
  if (raw == null || raw === "") return null;
  const value = String(raw).trim();
  return value || null;
}

function parseWordStyle(
  value: unknown,
  fallback: WordStyle,
): WordStyle {
  if (!isPlainObject(value)) return { ...fallback };

  const fill = String(value.fill ?? "").trim() || fallback.fill;
  const opacityRaw = Number(value.opacity);
  const opacity =
    "opacity" in value && Number.isFinite(opacityRaw)
      ? Math.min(1, Math.max(0, opacityRaw))
      : fallback.opacity;

  let border: WordBorder | null | undefined;
  if ("border" in value) {
    border = parseBorder(value.border);
  } else {
    border = fallback.border;
  }

  let background: BackgroundStyle | null | undefined;
  if ("background" in value) {
    if (value.background == null) background = null;
    else {
      background = parseBackground(
        value.background,
        fallback.background ?? { kind: "none" },
      );
    }
  } else {
    background = fallback.background;
  }

  const textShadow = parseOptionalString(
    value,
    "textShadow",
    fallback.textShadow,
  );

  return { fill, border, background, opacity, textShadow };
}

function parseWordStyleDelta(value: unknown): WordStyleDelta | undefined {
  if (!isPlainObject(value)) return undefined;
  const delta: WordStyleDelta = {};

  if ("fill" in value) {
    const fill = String(value.fill ?? "").trim();
    if (fill) delta.fill = fill;
  }
  if ("opacity" in value) {
    const opacityRaw = Number(value.opacity);
    if (Number.isFinite(opacityRaw)) {
      delta.opacity = Math.min(1, Math.max(0, opacityRaw));
    }
  }
  if ("border" in value) {
    delta.border = parseBorder(value.border);
  }
  if ("background" in value) {
    if (value.background == null) delta.background = null;
    else delta.background = parseBackground(value.background, { kind: "none" });
  }
  if ("textShadow" in value) {
    delta.textShadow = parseOptionalString(value, "textShadow", null) ?? null;
  }

  return Object.keys(delta).length > 0 ? delta : undefined;
}

/**
 * Normalize a partial/unknown caption group style against defaults.
 * Used by config loaders and template resolution.
 */
export function normalizeCaptionStyle(
  raw: unknown,
  fallback: CaptionGroupStyle = DEFAULT_CAPTION_STYLE,
): CaptionGroupStyle {
  const src = isPlainObject(raw) ? raw : {};
  const fontFamily = isCaptionFontId(src.fontFamily)
    ? src.fontFamily
    : fallback.fontFamily;
  const fontSize = Number(src.fontSize);
  const y = Number(src.y);
  const animation = isCaptionAnimation(src.animation)
    ? src.animation
    : fallback.animation;
  const textTransform = isCaptionTextTransform(src.textTransform)
    ? src.textTransform
    : fallback.textTransform;
  const captionsAtATime = Number(src.captionsAtATime);
  const fontStyle = isCaptionFontStyle(src.fontStyle)
    ? src.fontStyle
    : fallback.fontStyle;
  const textAlign = isCaptionTextAlign(src.textAlign)
    ? src.textAlign
    : fallback.textAlign;

  const background = parseBackground(
    src.background,
    fallback.background,
  );
  const wordStyle = parseWordStyle(src.wordStyle, fallback.wordStyle);

  const pastWordStyle =
    "pastWordStyle" in src
      ? parseWordStyleDelta(src.pastWordStyle)
      : fallback.pastWordStyle;
  const activeWordStyle =
    "activeWordStyle" in src
      ? parseWordStyleDelta(src.activeWordStyle)
      : fallback.activeWordStyle;
  const futureWordStyle =
    "futureWordStyle" in src
      ? parseWordStyleDelta(src.futureWordStyle)
      : fallback.futureWordStyle;

  return {
    fontFamily,
    fontSize:
      Number.isFinite(fontSize) && fontSize > 0
        ? fontSize
        : fallback.fontSize,
    y: clampCaptionY(Number.isFinite(y) ? y : fallback.y),
    animation,
    textTransform,
    captionsAtATime: clampCaptionsAtATime(
      Number.isFinite(captionsAtATime)
        ? captionsAtATime
        : fallback.captionsAtATime,
    ),
    background,
    fontStyle,
    textAlign,
    wordStyle,
    pastWordStyle,
    activeWordStyle,
    futureWordStyle,
  };
}

/** Normalize persisted user overrides (templateId stored separately). */
export function normalizeCaptionOverrides(
  raw: unknown,
): CaptionStyleOverrides {
  if (!isPlainObject(raw)) return {};
  const out: CaptionStyleOverrides = {};

  if ("y" in raw) {
    const y = Number(raw.y);
    if (Number.isFinite(y)) out.y = clampCaptionY(y);
  }
  if ("fontSize" in raw) {
    const fontSize = Number(raw.fontSize);
    if (Number.isFinite(fontSize) && fontSize > 0) out.fontSize = fontSize;
  }
  if ("captionsAtATime" in raw) {
    const n = Number(raw.captionsAtATime);
    if (Number.isFinite(n)) out.captionsAtATime = clampCaptionsAtATime(n);
  }
  if ("fill" in raw) {
    const fill = String(raw.fill ?? "").trim();
    if (fill) out.fill = fill;
  }

  return out;
}
