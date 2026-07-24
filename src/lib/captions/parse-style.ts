import {
  DEFAULT_CAPTION_STYLE,
  clampCaptionY,
  clampCaptionsAtATime,
  isCaptionAnimation,
  isCaptionBackdrop,
  isCaptionFontId,
  isCaptionFontStyle,
  isCaptionTextAlign,
  isCaptionTextTransform,
  type CaptionStyle,
  type CaptionStroke,
} from "./style";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStroke(value: unknown): CaptionStroke | null {
  if (value == null) return null;
  if (!isPlainObject(value)) return null;
  const width = Number(value.width);
  const color = String(value.color ?? "").trim();
  if (!Number.isFinite(width) || width <= 0 || !color) return null;
  return { width, color };
}

/**
 * Normalize a partial/unknown caption style against defaults.
 * Used by config loaders and editor patches.
 */
export function normalizeCaptionStyle(
  raw: unknown,
  fallback: CaptionStyle = DEFAULT_CAPTION_STYLE,
): CaptionStyle {
  const src = isPlainObject(raw) ? raw : {};
  const fontFamily = isCaptionFontId(src.fontFamily)
    ? src.fontFamily
    : fallback.fontFamily;
  const fontSize = Number(src.fontSize);
  const color = String(src.color ?? "").trim();
  const y = Number(src.y);
  const animation = isCaptionAnimation(src.animation)
    ? src.animation
    : fallback.animation;
  const textTransform = isCaptionTextTransform(src.textTransform)
    ? src.textTransform
    : fallback.textTransform;
  const captionsAtATime = Number(src.captionsAtATime);
  const shadow =
    typeof src.shadow === "boolean" ? src.shadow : fallback.shadow;
  const stack = typeof src.stack === "boolean" ? src.stack : (fallback.stack ?? false);
  const backdrop = isCaptionBackdrop(src.backdrop)
    ? src.backdrop
    : (fallback.backdrop ?? "none");
  const fontStyle = isCaptionFontStyle(src.fontStyle)
    ? src.fontStyle
    : (fallback.fontStyle ?? "normal");
  const textAlign = isCaptionTextAlign(src.textAlign)
    ? src.textAlign
    : (fallback.textAlign ?? "center");
  const contourBoard =
    typeof src.contourBoard === "boolean"
      ? src.contourBoard
      : (fallback.contourBoard ?? false);
  let backdropColor: string | null;
  if ("backdropColor" in src) {
    const raw = src.backdropColor;
    if (raw == null || raw === "") backdropColor = null;
    else {
      const color = String(raw).trim();
      backdropColor = color || null;
    }
  } else {
    backdropColor = fallback.backdropColor ?? null;
  }

  let stroke: CaptionStroke | null;
  if ("stroke" in src) {
    stroke = parseStroke(src.stroke);
  } else {
    stroke = fallback.stroke;
  }

  let textShadow: string | null;
  if ("textShadow" in src) {
    const raw = src.textShadow;
    if (raw == null || raw === "") textShadow = null;
    else {
      const value = String(raw).trim();
      textShadow = value || null;
    }
  } else {
    textShadow = fallback.textShadow ?? null;
  }

  return {
    fontFamily,
    fontSize:
      Number.isFinite(fontSize) && fontSize > 0
        ? fontSize
        : fallback.fontSize,
    color: color || fallback.color,
    y: clampCaptionY(Number.isFinite(y) ? y : fallback.y),
    animation,
    stroke,
    shadow,
    textTransform,
    captionsAtATime: clampCaptionsAtATime(
      Number.isFinite(captionsAtATime)
        ? captionsAtATime
        : fallback.captionsAtATime,
    ),
    stack,
    backdrop,
    fontStyle,
    textAlign,
    backdropColor,
    contourBoard,
    textShadow,
  };
}
