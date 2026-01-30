/**
 * Unicode Offset Conversion Tests
 *
 * Tests for byte offset to character offset conversion functions.
 * These tests verify that search highlight positions work correctly
 * for non-ASCII content (accented characters, CJK, emojis).
 */
import { describe, it, expect } from "vitest";

/**
 * Reference implementation for byte-to-UTF16 code unit conversion.
 * This mirrors the Rust implementation in lib.rs.
 * Note: The actual conversion now happens in Rust, but we keep
 * this for documentation and future TypeScript-side utilities.
 *
 * JavaScript strings use UTF-16 internally, so we convert byte offsets
 * to UTF-16 code unit offsets. Characters outside the BMP (emoji, etc.)
 * use 2 UTF-16 code units (surrogate pairs).
 */
function byteOffsetToUtf16Offset(text: string, byteOffset: number): number {
  const encoder = new TextEncoder();
  let bytes = 0;
  let utf16Units = 0;

  for (const char of text) {
    if (bytes >= byteOffset) break;
    bytes += encoder.encode(char).length;
    // Each JS char is a UTF-16 code unit; surrogate pairs appear as 2 chars
    utf16Units += char.length;
  }

  return utf16Units;
}

describe("Unicode byte/char offset conversion", () => {
  describe("ASCII text", () => {
    it("handles simple ASCII (identity)", () => {
      const text = "hello world";
      // ASCII chars are 1 byte each, so byte offset = char offset
      expect(byteOffsetToUtf16Offset(text, 0)).toBe(0);
      expect(byteOffsetToUtf16Offset(text, 5)).toBe(5);
      expect(byteOffsetToUtf16Offset(text, 11)).toBe(11);
    });

    it("handles empty string", () => {
      expect(byteOffsetToUtf16Offset("", 0)).toBe(0);
    });
  });

  describe("multi-byte UTF-8 characters", () => {
    it("handles 2-byte characters (accented latin)", () => {
      // "café" - 'é' is 2 bytes in UTF-8 (C3 A9)
      const text = "café";
      // c=1, a=1, f=1, é=2 -> total 5 bytes
      expect(byteOffsetToUtf16Offset(text, 0)).toBe(0); // before 'c'
      expect(byteOffsetToUtf16Offset(text, 1)).toBe(1); // before 'a'
      expect(byteOffsetToUtf16Offset(text, 2)).toBe(2); // before 'f'
      expect(byteOffsetToUtf16Offset(text, 3)).toBe(3); // before 'é'
      expect(byteOffsetToUtf16Offset(text, 5)).toBe(4); // end
    });

    it("handles German umlauts", () => {
      // "Größe" - ö and ß are 2 bytes each
      const text = "Größe";
      // G=1, r=1, ö=2, ß=2, e=1 -> total 7 bytes
      expect(byteOffsetToUtf16Offset(text, 0)).toBe(0); // G
      expect(byteOffsetToUtf16Offset(text, 1)).toBe(1); // r
      expect(byteOffsetToUtf16Offset(text, 2)).toBe(2); // ö (starts at byte 2)
      expect(byteOffsetToUtf16Offset(text, 4)).toBe(3); // ß (starts at byte 4)
      expect(byteOffsetToUtf16Offset(text, 6)).toBe(4); // e (starts at byte 6)
    });

    it("handles 3-byte characters (CJK)", () => {
      // "日本語" - each CJK char is 3 bytes in UTF-8
      const text = "日本語";
      // 日=3, 本=3, 語=3 -> total 9 bytes
      expect(byteOffsetToUtf16Offset(text, 0)).toBe(0); // 日
      expect(byteOffsetToUtf16Offset(text, 3)).toBe(1); // 本
      expect(byteOffsetToUtf16Offset(text, 6)).toBe(2); // 語
      expect(byteOffsetToUtf16Offset(text, 9)).toBe(3); // end
    });

    it("handles mixed ASCII and CJK", () => {
      // "Hello世界"
      const text = "Hello世界";
      // H=1, e=1, l=1, l=1, o=1, 世=3, 界=3 -> total 11 bytes
      expect(byteOffsetToUtf16Offset(text, 0)).toBe(0); // H
      expect(byteOffsetToUtf16Offset(text, 5)).toBe(5); // 世 (starts at byte 5)
      expect(byteOffsetToUtf16Offset(text, 8)).toBe(6); // 界 (starts at byte 8)
      expect(byteOffsetToUtf16Offset(text, 11)).toBe(7); // end
    });
  });

  describe("4-byte characters (emoji)", () => {
    it("handles simple emoji - UTF-16 surrogate pairs", () => {
      // "a🎉b" - 🎉 is 4 bytes in UTF-8
      const text = "a🎉b";
      // a=1 byte, 🎉=4 bytes, b=1 byte -> total 6 bytes
      // In UTF-16: a=1 code unit, 🎉=2 code units (surrogate pair), b=1 code unit
      // JavaScript string indices use UTF-16 code units
      expect(byteOffsetToUtf16Offset(text, 0)).toBe(0); // a (index 0)
      expect(byteOffsetToUtf16Offset(text, 1)).toBe(1); // 🎉 starts at index 1
      // After emoji at byte 5, UTF-16 position is 3 (a=0, 🎉 occupies 1&2, b=3)
      expect(byteOffsetToUtf16Offset(text, 5)).toBe(3); // b
    });

    it("handles multiple emoji - UTF-16 surrogate pairs", () => {
      // "🇺🇸🇯🇵" - flag emojis are composed of 2x4-byte chars each
      const text = "🇺🇸🇯🇵";
      // Each regional indicator is 4 bytes UTF-8, 2 UTF-16 code units
      // 🇺=4 bytes, 🇸=4 bytes, 🇯=4 bytes, 🇵=4 bytes -> total 16 bytes
      // In UTF-16: 🇺=2, 🇸=2, 🇯=2, 🇵=2 -> total 8 code units
      expect(byteOffsetToUtf16Offset(text, 0)).toBe(0);
      expect(byteOffsetToUtf16Offset(text, 4)).toBe(2);  // After 🇺 (2 code units)
      expect(byteOffsetToUtf16Offset(text, 8)).toBe(4);  // After 🇺🇸 (4 code units)
      expect(byteOffsetToUtf16Offset(text, 12)).toBe(6); // After 🇺🇸🇯 (6 code units)
    });

    it("handles emoji sequences", () => {
      // "👨‍👩‍👧" - family emoji with ZWJ
      const text = "👨‍👩‍👧";
      // This is: man(4) + ZWJ(3) + woman(4) + ZWJ(3) + girl(4) = 18 bytes
      // Character count depends on how we count - grapheme vs code point
      // For search purposes, UTF-16 code unit counting matches JS string behavior
      const encoder = new TextEncoder();
      const bytes = encoder.encode(text);
      expect(bytes.length).toBe(18); // Verify our byte count understanding
    });
  });

  describe("edge cases", () => {
    it("handles offset at start", () => {
      expect(byteOffsetToUtf16Offset("hello", 0)).toBe(0);
      expect(byteOffsetToUtf16Offset("日本語", 0)).toBe(0);
    });

    it("handles offset at end", () => {
      const text = "test";
      expect(byteOffsetToUtf16Offset(text, 4)).toBe(4);
    });

    it("handles offset past end", () => {
      const text = "ab";
      // Should return char count when offset exceeds text
      expect(byteOffsetToUtf16Offset(text, 100)).toBe(2);
    });

    it("handles mixed scripts", () => {
      // Arabic, Hebrew, Thai mixed with Latin
      const text = "Aب"; // Latin A + Arabic Ba
      // A=1, ب=2 -> total 3 bytes
      expect(byteOffsetToUtf16Offset(text, 0)).toBe(0); // A
      expect(byteOffsetToUtf16Offset(text, 1)).toBe(1); // ب
      expect(byteOffsetToUtf16Offset(text, 3)).toBe(2); // end
    });
  });

  describe("practical search scenarios", () => {
    it("finds correct position of match after multi-byte chars", () => {
      // Search for "test" in "日本語test"
      const text = "日本語test";
      // 日=3, 本=3, 語=3, t=1, e=1, s=1, t=1 -> total 13 bytes
      // "test" starts at byte 9, which is char index 3
      const matchStartByte = 9;
      const matchEndByte = 13;

      expect(byteOffsetToUtf16Offset(text, matchStartByte)).toBe(3);
      expect(byteOffsetToUtf16Offset(text, matchEndByte)).toBe(7);
    });

    it("finds correct position of match with emoji before", () => {
      // Search for "code" in "🎉code"
      const text = "🎉code";
      // 🎉=4 bytes, c=1, o=1, d=1, e=1 -> total 8 bytes
      // In UTF-16: 🎉=2 code units, c=1, o=1, d=1, e=1 -> total 6 code units
      // "code" starts at byte 4, which is UTF-16 index 2 (after 2 surrogate pair code units)
      const matchStartByte = 4;
      const matchEndByte = 8;

      // Using UTF-16 code unit counting (matches JavaScript string behavior)
      expect(byteOffsetToUtf16Offset(text, matchStartByte)).toBe(2); // After emoji's 2 surrogate pair code units
      expect(byteOffsetToUtf16Offset(text, matchEndByte)).toBe(6);   // 2 + 4 ASCII chars
    });
  });
});
