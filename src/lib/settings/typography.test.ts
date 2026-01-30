import { describe, it, expect } from "vitest";
import {
  DEFAULT_TYPOGRAPHY,
  clampFontSize,
  clampLineHeight,
  clampMaxLineWidth,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_STEP,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  LINE_HEIGHT_STEP,
  MAX_LINE_WIDTH_MIN,
  MAX_LINE_WIDTH_MAX,
  MAX_LINE_WIDTH_STEP,
} from "./typography";

describe("Typography Settings", () => {
  describe("DEFAULT_TYPOGRAPHY", () => {
    it("has sensible default values", () => {
      expect(DEFAULT_TYPOGRAPHY.fontSize).toBe(18);
      expect(DEFAULT_TYPOGRAPHY.lineHeight).toBe(1.8); // Aligns with slider step (0.1)
      expect(DEFAULT_TYPOGRAPHY.maxLineWidth).toBe(72);
    });
  });

  describe("Font Size Constants", () => {
    it("defines valid font size range", () => {
      expect(FONT_SIZE_MIN).toBe(12);
      expect(FONT_SIZE_MAX).toBe(24);
      expect(FONT_SIZE_STEP).toBe(1);
    });
  });

  describe("Line Height Constants", () => {
    it("defines valid line height range", () => {
      expect(LINE_HEIGHT_MIN).toBe(1.2);
      expect(LINE_HEIGHT_MAX).toBe(2.4);
      expect(LINE_HEIGHT_STEP).toBe(0.1);
    });
  });

  describe("Max Line Width Constants", () => {
    it("defines valid max line width range", () => {
      expect(MAX_LINE_WIDTH_MIN).toBe(40);
      expect(MAX_LINE_WIDTH_MAX).toBe(120);
      expect(MAX_LINE_WIDTH_STEP).toBe(4);
    });
  });

  describe("clampFontSize", () => {
    it("returns value within range", () => {
      expect(clampFontSize(16)).toBe(16);
      expect(clampFontSize(18)).toBe(18);
    });

    it("clamps below minimum to minimum", () => {
      expect(clampFontSize(8)).toBe(FONT_SIZE_MIN);
      expect(clampFontSize(0)).toBe(FONT_SIZE_MIN);
      expect(clampFontSize(-10)).toBe(FONT_SIZE_MIN);
    });

    it("clamps above maximum to maximum", () => {
      expect(clampFontSize(30)).toBe(FONT_SIZE_MAX);
      expect(clampFontSize(100)).toBe(FONT_SIZE_MAX);
    });

    it("rounds to nearest step", () => {
      expect(clampFontSize(16.4)).toBe(16);
      expect(clampFontSize(16.6)).toBe(17);
    });
  });

  describe("clampLineHeight", () => {
    it("returns value within range", () => {
      expect(clampLineHeight(1.5)).toBe(1.5);
      expect(clampLineHeight(1.75)).toBe(1.8); // Rounds to nearest 0.1
    });

    it("clamps below minimum to minimum", () => {
      expect(clampLineHeight(1.0)).toBe(LINE_HEIGHT_MIN);
      expect(clampLineHeight(0.5)).toBe(LINE_HEIGHT_MIN);
    });

    it("clamps above maximum to maximum", () => {
      expect(clampLineHeight(3.0)).toBe(LINE_HEIGHT_MAX);
      expect(clampLineHeight(5.0)).toBe(LINE_HEIGHT_MAX);
    });

    it("rounds to nearest step (0.1)", () => {
      expect(clampLineHeight(1.54)).toBe(1.5);
      expect(clampLineHeight(1.56)).toBe(1.6);
    });
  });

  describe("clampMaxLineWidth", () => {
    it("returns value within range", () => {
      expect(clampMaxLineWidth(72)).toBe(72);
      expect(clampMaxLineWidth(80)).toBe(80);
    });

    it("clamps below minimum to minimum", () => {
      expect(clampMaxLineWidth(20)).toBe(MAX_LINE_WIDTH_MIN);
      expect(clampMaxLineWidth(0)).toBe(MAX_LINE_WIDTH_MIN);
    });

    it("clamps above maximum to maximum", () => {
      expect(clampMaxLineWidth(200)).toBe(MAX_LINE_WIDTH_MAX);
      expect(clampMaxLineWidth(500)).toBe(MAX_LINE_WIDTH_MAX);
    });

    it("rounds to nearest step (4ch)", () => {
      expect(clampMaxLineWidth(71)).toBe(72); // Rounds to nearest 4
      expect(clampMaxLineWidth(73)).toBe(72);
      expect(clampMaxLineWidth(74)).toBe(76);
    });
  });
});
