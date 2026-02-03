/**
 * Tests for Blockquote Decorations
 *
 * Phase 3: Verify blockquote markers are hidden and
 * proper styling is applied.
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  blockquoteField,
  extractBlockquoteData,
} from "../decorations/blockquotes";

/**
 * Helper to create an editor state with blockquote extension
 */
function createTestState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), blockquoteField],
  });
}

describe("Blockquote Decorations", () => {
  describe("blockquoteField", () => {
    it("creates decorations for simple blockquote", () => {
      const state = createTestState("> This is a quote");
      const decorations = state.field(blockquoteField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for multi-line blockquote", () => {
      const state = createTestState("> Line 1\n> Line 2\n> Line 3");
      const decorations = state.field(blockquoteField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for nested blockquotes", () => {
      const state = createTestState("> Level 1\n>> Level 2\n>>> Level 3");
      const decorations = state.field(blockquoteField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles empty document", () => {
      const state = createTestState("");
      const decorations = state.field(blockquoteField);

      expect(decorations.size).toBe(0);
    });

    it("handles document with no blockquotes", () => {
      const state = createTestState("Just plain text.");
      const decorations = state.field(blockquoteField);

      expect(decorations.size).toBe(0);
    });

    it("does not treat > in middle of line as blockquote", () => {
      const state = createTestState("This is not > a blockquote");
      const decorations = state.field(blockquoteField);

      expect(decorations.size).toBe(0);
    });

    it("handles blockquote with inline formatting", () => {
      const state = createTestState("> This has **bold** text");
      const decorations = state.field(blockquoteField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles blockquote followed by regular text", () => {
      const state = createTestState("> Quote\n\nRegular paragraph");
      const decorations = state.field(blockquoteField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("updates decorations when document changes", () => {
      const state1 = createTestState("Plain text");
      const decorations1 = state1.field(blockquoteField);
      expect(decorations1.size).toBe(0);

      const state2 = createTestState("> New quote");
      const decorations2 = state2.field(blockquoteField);
      expect(decorations2.size).toBeGreaterThan(0);
    });
  });

  describe("extractBlockquoteData", () => {
    it("extracts single blockquote line", () => {
      const state = createTestState("> Quote text");
      const quotes = extractBlockquoteData(state);

      expect(quotes).toHaveLength(1);
      expect(quotes[0].depth).toBe(1);
    });

    it("extracts multi-line blockquote", () => {
      const state = createTestState("> Line 1\n> Line 2");
      const quotes = extractBlockquoteData(state);

      expect(quotes).toHaveLength(2);
    });

    it("extracts nesting depth for nested blockquotes", () => {
      const state = createTestState("> Level 1\n>> Level 2\n>>> Level 3");
      const quotes = extractBlockquoteData(state);

      expect(quotes).toHaveLength(3);
      expect(quotes[0].depth).toBe(1);
      expect(quotes[1].depth).toBe(2);
      expect(quotes[2].depth).toBe(3);
    });

    it("extracts position information", () => {
      const state = createTestState("> Quote");
      const quotes = extractBlockquoteData(state);

      expect(quotes[0].from).toBeDefined();
      expect(quotes[0].to).toBeDefined();
      expect(quotes[0].markerFrom).toBeDefined();
      expect(quotes[0].markerTo).toBeDefined();
    });

    it("extracts text content", () => {
      const state = createTestState("> Hello World");
      const quotes = extractBlockquoteData(state);

      expect(quotes[0].text).toBe("Hello World");
    });

    it("extracts line number", () => {
      const state = createTestState("Paragraph\n\n> Quote on line 3");
      const quotes = extractBlockquoteData(state);

      expect(quotes[0].line).toBe(3);
    });

    it("returns empty array for document with no blockquotes", () => {
      const state = createTestState("No blockquotes here.");
      const quotes = extractBlockquoteData(state);

      expect(quotes).toHaveLength(0);
    });
  });

  describe("Nested blockquote depth detection", () => {
    it("detects single level (>)", () => {
      const state = createTestState("> Single level");
      const quotes = extractBlockquoteData(state);

      expect(quotes[0].depth).toBe(1);
    });

    it("detects double level (>>)", () => {
      const state = createTestState(">> Double level");
      const quotes = extractBlockquoteData(state);

      expect(quotes[0].depth).toBe(2);
    });

    it("detects triple level (>>>)", () => {
      const state = createTestState(">>> Triple level");
      const quotes = extractBlockquoteData(state);

      expect(quotes[0].depth).toBe(3);
    });

    it("handles spaced nested markers (> > >)", () => {
      const state = createTestState("> > > Spaced triple");
      const quotes = extractBlockquoteData(state);

      expect(quotes[0].depth).toBe(3);
    });
  });

  describe("Blockquote with other markdown elements", () => {
    it("handles blockquote containing heading", () => {
      const state = createTestState("> # Quoted Heading");
      const quotes = extractBlockquoteData(state);

      expect(quotes).toHaveLength(1);
    });

    it("handles blockquote containing list", () => {
      const state = createTestState("> - List item 1\n> - List item 2");
      const quotes = extractBlockquoteData(state);

      expect(quotes).toHaveLength(2);
    });

    it("handles blockquote containing code", () => {
      const state = createTestState("> `inline code` in quote");
      const quotes = extractBlockquoteData(state);

      expect(quotes).toHaveLength(1);
    });
  });

  describe("Edge cases", () => {
    it("handles empty blockquote marker only", () => {
      const state = createTestState(">");
      const quotes = extractBlockquoteData(state);

      // Empty blockquote is still a blockquote
      expect(quotes).toHaveLength(1);
      expect(quotes[0].text).toBe("");
    });

    it("handles blockquote with only whitespace content", () => {
      const state = createTestState(">   ");
      const quotes = extractBlockquoteData(state);

      expect(quotes).toHaveLength(1);
    });

    it("handles multiple separate blockquotes", () => {
      const state = createTestState("> Quote 1\n\n> Quote 2");
      const quotes = extractBlockquoteData(state);

      expect(quotes).toHaveLength(2);
    });
  });
});
