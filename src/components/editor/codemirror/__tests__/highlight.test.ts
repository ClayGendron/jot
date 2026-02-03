/**
 * Tests for Highlight Decoration (==text==)
 *
 * Phase 2: Custom highlight syntax not in GFM.
 * Uses regex-based detection to hide == markers and apply styling.
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  highlightField,
  findHighlightRanges,
} from "../decorations/highlight";

/**
 * Helper to create an editor state with highlight extension
 */
function createTestState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), highlightField],
  });
}

describe("Highlight Decoration", () => {
  describe("findHighlightRanges", () => {
    it("finds single highlight range", () => {
      const doc = "This is ==highlighted== text";
      const ranges = findHighlightRanges(doc);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        from: 8, // start of ==
        to: 23, // end of ==
        contentFrom: 10, // start of "highlighted"
        contentTo: 21, // end of "highlighted"
      });
    });

    it("finds multiple highlight ranges", () => {
      const doc = "==first== and ==second==";
      const ranges = findHighlightRanges(doc);

      expect(ranges).toHaveLength(2);
      expect(ranges[0].contentFrom).toBe(2);
      expect(ranges[0].contentTo).toBe(7);
      expect(ranges[1].contentFrom).toBe(16);
      expect(ranges[1].contentTo).toBe(22);
    });

    it("returns empty array for no highlights", () => {
      const doc = "Plain text without highlights";
      const ranges = findHighlightRanges(doc);

      expect(ranges).toHaveLength(0);
    });

    it("handles adjacent highlights", () => {
      const doc = "==one====two==";
      const ranges = findHighlightRanges(doc);

      expect(ranges).toHaveLength(2);
    });

    it("handles highlight at start of document", () => {
      const doc = "==start== of text";
      const ranges = findHighlightRanges(doc);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].from).toBe(0);
    });

    it("handles highlight at end of document", () => {
      const doc = "text at ==end==";
      const ranges = findHighlightRanges(doc);

      expect(ranges).toHaveLength(1);
      expect(ranges[0].to).toBe(15);
    });

    it("handles multiline content", () => {
      const doc = "Line 1\n==highlighted==\nLine 3";
      const ranges = findHighlightRanges(doc);

      expect(ranges).toHaveLength(1);
    });

    it("ignores incomplete highlight syntax", () => {
      const doc = "==incomplete";
      const ranges = findHighlightRanges(doc);

      expect(ranges).toHaveLength(0);
    });

    it("ignores highlight inside code blocks", () => {
      const doc = "```\n==code==\n```";
      // Need state for code detection
      const state = createTestState(doc);
      const ranges = findHighlightRanges(doc, state);

      // Should not find highlight inside code block
      expect(ranges).toHaveLength(0);
    });

    it("ignores highlight inside inline code", () => {
      const doc = "This `==code==` is inline";
      // Need state for code detection
      const state = createTestState(doc);
      const ranges = findHighlightRanges(doc, state);

      expect(ranges).toHaveLength(0);
    });

    it("handles empty highlight", () => {
      const doc = "This ====  is empty";
      const ranges = findHighlightRanges(doc);

      // Empty highlight should still be detected
      expect(ranges).toHaveLength(1);
    });
  });

  describe("highlightField", () => {
    it("creates decorations for highlight markers", () => {
      const state = createTestState("This is ==highlighted== text");
      const decorations = state.field(highlightField);

      // Should have decorations for == markers (hide) and content (style)
      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles document without highlights", () => {
      const state = createTestState("Plain text");
      const decorations = state.field(highlightField);

      expect(decorations.size).toBe(0);
    });

    it("updates decorations when document changes", () => {
      const state1 = createTestState("Plain text");
      expect(state1.field(highlightField).size).toBe(0);

      const state2 = createTestState("==highlighted==");
      expect(state2.field(highlightField).size).toBeGreaterThan(0);
    });
  });

  describe("Edge cases", () => {
    it("handles empty document", () => {
      const state = createTestState("");
      const decorations = state.field(highlightField);

      expect(decorations.size).toBe(0);
    });

    it("handles document with only markers", () => {
      const state = createTestState("==test==");
      const decorations = state.field(highlightField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles nested markdown inside highlight", () => {
      // Highlight containing bold
      const doc = "==**bold** inside==";
      const ranges = findHighlightRanges(doc);

      expect(ranges).toHaveLength(1);
    });

    it("handles special characters in highlight", () => {
      const doc = "==test (special) [chars]==";
      const ranges = findHighlightRanges(doc);

      expect(ranges).toHaveLength(1);
    });
  });
});
