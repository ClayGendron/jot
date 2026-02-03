/**
 * Tests for Format Active Detection
 *
 * Phase 2: Verify detection of cursor position inside formatting
 * for toolbar active states.
 */

import { describe, it, expect } from "vitest";
import { EditorState, EditorSelection } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  isFormatActive,
  isBoldActive,
  isItalicActive,
  isStrikethroughActive,
  isCodeActive,
  getActiveFormats,
} from "../utils/formatActive";

/**
 * Helper to create an editor state with cursor at specific position
 */
function createTestState(doc: string, cursorPos: number): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] })],
    selection: EditorSelection.cursor(cursorPos),
  });
}

describe("Format Active Detection", () => {
  describe("isBoldActive", () => {
    it("returns true when cursor is inside bold text", () => {
      const state = createTestState("This is **bold** text", 12); // Inside "bold"
      expect(isBoldActive(state)).toBe(true);
    });

    it("returns false when cursor is outside bold text", () => {
      const state = createTestState("This is **bold** text", 3); // In "This"
      expect(isBoldActive(state)).toBe(false);
    });

    it("returns false when document has no bold", () => {
      const state = createTestState("Plain text", 5);
      expect(isBoldActive(state)).toBe(false);
    });

    it("handles cursor at start of bold text", () => {
      const state = createTestState("**bold**", 2); // Right after **
      expect(isBoldActive(state)).toBe(true);
    });

    it("handles cursor at end of bold text", () => {
      const state = createTestState("**bold**", 6); // Right before **
      expect(isBoldActive(state)).toBe(true);
    });
  });

  describe("isItalicActive", () => {
    it("returns true when cursor is inside italic text", () => {
      const state = createTestState("This is *italic* text", 11); // Inside "italic"
      expect(isItalicActive(state)).toBe(true);
    });

    it("returns false when cursor is outside italic text", () => {
      const state = createTestState("This is *italic* text", 3);
      expect(isItalicActive(state)).toBe(false);
    });

    it("distinguishes italic from bold", () => {
      const state = createTestState("**bold** and *italic*", 19); // Inside italic
      expect(isItalicActive(state)).toBe(true);
      expect(isBoldActive(state)).toBe(false);
    });
  });

  describe("isStrikethroughActive", () => {
    it("returns true when cursor is inside strikethrough", () => {
      const state = createTestState("This is ~~deleted~~ text", 14); // Inside "deleted"
      expect(isStrikethroughActive(state)).toBe(true);
    });

    it("returns false when cursor is outside strikethrough", () => {
      const state = createTestState("This is ~~deleted~~ text", 3);
      expect(isStrikethroughActive(state)).toBe(false);
    });
  });

  describe("isCodeActive", () => {
    it("returns true when cursor is inside inline code", () => {
      const state = createTestState("This is `code` text", 11); // Inside "code"
      expect(isCodeActive(state)).toBe(true);
    });

    it("returns false when cursor is outside inline code", () => {
      const state = createTestState("This is `code` text", 3);
      expect(isCodeActive(state)).toBe(false);
    });
  });

  describe("isFormatActive (generic)", () => {
    it("detects StrongEmphasis node for bold", () => {
      const state = createTestState("**bold**", 4);
      expect(isFormatActive(state, "StrongEmphasis")).toBe(true);
    });

    it("detects Emphasis node for italic", () => {
      const state = createTestState("*italic*", 3);
      expect(isFormatActive(state, "Emphasis")).toBe(true);
    });

    it("detects Strikethrough node", () => {
      const state = createTestState("~~strike~~", 5);
      expect(isFormatActive(state, "Strikethrough")).toBe(true);
    });

    it("detects InlineCode node", () => {
      const state = createTestState("`code`", 3);
      expect(isFormatActive(state, "InlineCode")).toBe(true);
    });
  });

  describe("getActiveFormats", () => {
    it("returns empty set for plain text", () => {
      const state = createTestState("Plain text", 5);
      const formats = getActiveFormats(state);
      expect(formats.size).toBe(0);
    });

    it("returns bold when cursor in bold", () => {
      const state = createTestState("**bold**", 4);
      const formats = getActiveFormats(state);
      expect(formats.has("bold")).toBe(true);
    });

    it("returns italic when cursor in italic", () => {
      const state = createTestState("*italic*", 4);
      const formats = getActiveFormats(state);
      expect(formats.has("italic")).toBe(true);
    });

    it("returns multiple formats for nested formatting", () => {
      const state = createTestState("***bold and italic***", 10);
      const formats = getActiveFormats(state);
      expect(formats.has("bold")).toBe(true);
      expect(formats.has("italic")).toBe(true);
    });

    it("returns strikethrough when cursor in strikethrough", () => {
      const state = createTestState("~~strike~~", 5);
      const formats = getActiveFormats(state);
      expect(formats.has("strikethrough")).toBe(true);
    });

    it("returns code when cursor in inline code", () => {
      const state = createTestState("`code`", 3);
      const formats = getActiveFormats(state);
      expect(formats.has("code")).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("handles empty document", () => {
      const state = createTestState("", 0);
      expect(isBoldActive(state)).toBe(false);
      expect(getActiveFormats(state).size).toBe(0);
    });

    it("handles cursor at document start", () => {
      const state = createTestState("**bold**", 0);
      expect(isBoldActive(state)).toBe(false);
    });

    it("handles cursor at document end", () => {
      // Cursor at position 8 is at the end of the StrongEmphasis node boundary
      // The parser considers this position still within the node
      const state = createTestState("**bold**", 8);
      expect(isBoldActive(state)).toBe(true);
    });

    it("handles cursor after bold with trailing text", () => {
      // Cursor after the closing ** in "**bold** text"
      const state = createTestState("**bold** text", 9);
      expect(isBoldActive(state)).toBe(false);
    });

    it("handles adjacent formatting", () => {
      const state = createTestState("**bold***italic*", 13); // In italic
      expect(isBoldActive(state)).toBe(false);
      expect(isItalicActive(state)).toBe(true);
    });
  });
});
