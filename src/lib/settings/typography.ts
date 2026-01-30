/**
 * Typography settings types and utilities
 *
 * Defines the typography customization options for the editor:
 * - Font size (in pixels)
 * - Line height (as a multiplier)
 * - Max line width (in characters)
 */

/**
 * Typography settings interface
 */
export interface TypographySettings {
  /** Font size in pixels */
  fontSize: number;
  /** Line height as a multiplier (e.g., 1.5, 1.75) */
  lineHeight: number;
  /** Maximum line width in characters (ch units) */
  maxLineWidth: number;
}

// Font size constraints
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 24;
export const FONT_SIZE_STEP = 1;
export const FONT_SIZE_DEFAULT = 18;

// Line height constraints
export const LINE_HEIGHT_MIN = 1.2;
export const LINE_HEIGHT_MAX = 2.4;
export const LINE_HEIGHT_STEP = 0.1;
export const LINE_HEIGHT_DEFAULT = 1.8;

// Max line width constraints (in ch units)
export const MAX_LINE_WIDTH_MIN = 40;
export const MAX_LINE_WIDTH_MAX = 120;
export const MAX_LINE_WIDTH_STEP = 4;
export const MAX_LINE_WIDTH_DEFAULT = 72;

/**
 * Default typography settings
 */
export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  fontSize: FONT_SIZE_DEFAULT,
  lineHeight: LINE_HEIGHT_DEFAULT, // 1.8 - aligns with slider step (0.1)
  maxLineWidth: MAX_LINE_WIDTH_DEFAULT,
};

/**
 * Clamp and round font size to valid range
 */
export function clampFontSize(value: number): number {
  const clamped = Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, value));
  return Math.round(clamped / FONT_SIZE_STEP) * FONT_SIZE_STEP;
}

/**
 * Clamp and round line height to valid range
 */
export function clampLineHeight(value: number): number {
  const clamped = Math.max(LINE_HEIGHT_MIN, Math.min(LINE_HEIGHT_MAX, value));
  // Round to nearest 0.1, fixing floating point precision
  return Math.round(clamped * 10) / 10;
}

/**
 * Clamp and round max line width to valid range
 */
export function clampMaxLineWidth(value: number): number {
  const clamped = Math.max(MAX_LINE_WIDTH_MIN, Math.min(MAX_LINE_WIDTH_MAX, value));
  // Round to nearest step
  return Math.round(clamped / MAX_LINE_WIDTH_STEP) * MAX_LINE_WIDTH_STEP;
}
