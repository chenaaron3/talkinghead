import { resolveCaptionFont, type CaptionStyle } from "../../lib/captions/style";
import {
  COMPOSITION_WIDTH,
  SAFE_AREA,
} from "../../lib/episode/constants";
import type { CaptionWord } from "../../lib/types";

export const CONTOUR_PAD_X_EM = 0.45;
export const CONTOUR_PAD_Y_EM = 0.2;
export const CONTOUR_RADIUS_EM = 0.55;
export const CONTOUR_LINE_HEIGHT = 1.05;

export type ContourLine = { word: CaptionWord; index: number }[];

function parsePercent(value: string): number {
  return Number.parseFloat(value) / 100;
}

/** Horizontal room titles/captions get inside the safe area. */
export function safeContentWidthPx(): number {
  return (
    COMPOSITION_WIDTH *
    (1 - parsePercent(SAFE_AREA.left) - parsePercent(SAFE_AREA.right))
  );
}

function contourCssFont(style: CaptionStyle): string {
  const font = resolveCaptionFont(style.fontFamily);
  const fontStyle = style.fontStyle ?? "normal";
  return `${fontStyle} ${font.weight} ${style.fontSize}px ${font.family}`;
}

function applyTextTransform(
  text: string,
  transform: CaptionStyle["textTransform"],
): string {
  if (transform === "uppercase") return text.toUpperCase();
  if (transform === "lowercase") return text.toLowerCase();
  return text;
}

let measureCtx: CanvasRenderingContext2D | null = null;

function measureTextWidth(
  text: string,
  font: string,
  letterSpacingEm: number,
  fontSize: number,
): number {
  if (typeof document === "undefined") {
    return text.length * fontSize * 0.55;
  }
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!measureCtx) return text.length * fontSize * 0.55;
  measureCtx.font = font;
  const base = measureCtx.measureText(text).width;
  if (letterSpacingEm === 0 || text.length <= 1) return base;
  return base + letterSpacingEm * fontSize * (text.length - 1);
}

/**
 * Greedy wrap (plus hard `\n` breaks) so each contour pill is an explicit
 * centered line — avoids box-decoration-break wrap-space asymmetry.
 */
export function wrapContourLines(
  words: CaptionWord[],
  style: CaptionStyle,
  maxWidthPx: number,
): ContourLine[] {
  const font = contourCssFont(style);
  const letterSpacingEm = style.fontFamily === "montserrat" ? -0.02 : 0;
  const padX = CONTOUR_PAD_X_EM * style.fontSize;
  const maxText = Math.max(40, maxWidthPx - padX * 2);
  const spaceW = measureTextWidth(" ", font, letterSpacingEm, style.fontSize);

  const lines: ContourLine[] = [];
  let current: ContourLine = [];
  let currentW = 0;

  const flush = () => {
    if (current.length === 0) return;
    lines.push(current);
    current = [];
    currentW = 0;
  };

  words.forEach((word, index) => {
    if (word.text === "\n") {
      flush();
      return;
    }
    const display = applyTextTransform(word.text, style.textTransform);
    const w = measureTextWidth(display, font, letterSpacingEm, style.fontSize);
    if (current.length > 0 && currentW + spaceW + w > maxText) {
      flush();
    }
    if (current.length > 0) currentW += spaceW;
    current.push({ word, index });
    currentW += w;
  });
  flush();
  return lines;
}
