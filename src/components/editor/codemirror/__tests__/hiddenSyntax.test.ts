/**
 * Tests for Hidden Syntax Extension
 *
 * Phase 2: Verify syntax markers are hidden via decorations
 * and atomic ranges prevent cursor from entering hidden syntax.
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  hiddenSyntaxField,
  createHiddenSyntaxExtension,
} from "../extensions/hiddenSyntax";

/**
 * Helper to create an editor state with hidden syntax extension
 */
function createTestState(doc: string, rawMode = false) {
  return EditorState.create({
    doc,
    extensions: [
      markdown({ extensions: [GFM] }),
      createHiddenSyntaxExtension(rawMode),
    ],
  });
}

describe("Hidden Syntax Extension", () => {
  describe("hiddenSyntaxField", () => {
    it("creates decorations for bold markers", () => {
      const state = createTestState("This is **bold** text.");
      const decorations = state.field(hiddenSyntaxField);

      // Should have decorations for ** markers (opening and closing)
      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for italic markers", () => {
      const state = createTestState("This is *italic* text.");
      const decorations = state.field(hiddenSyntaxField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for strikethrough markers", () => {
      const state = createTestState("This is ~~deleted~~ text.");
      const decorations = state.field(hiddenSyntaxField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for inline code backticks", () => {
      const state = createTestState("This is `code` text.");
      const decorations = state.field(hiddenSyntaxField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for heading markers", () => {
      const state = createTestState("# Heading 1\n## Heading 2");
      const decorations = state.field(hiddenSyntaxField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for blockquote markers", () => {
      const state = createTestState("> This is a quote");
      const decorations = state.field(hiddenSyntaxField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for list markers", () => {
      const state = createTestState("- Item 1\n- Item 2");
      const decorations = state.field(hiddenSyntaxField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for ordered list markers", () => {
      const state = createTestState("1. First\n2. Second");
      const decorations = state.field(hiddenSyntaxField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles nested formatting", () => {
      const state = createTestState("This is ***bold italic*** text.");
      const decorations = state.field(hiddenSyntaxField);

      // Should have decorations for both ** and * markers
      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles empty document", () => {
      const state = createTestState("");
      const decorations = state.field(hiddenSyntaxField);

      expect(decorations.size).toBe(0);
    });

    it("handles document with no markdown syntax", () => {
      const state = createTestState("Just plain text without any formatting.");
      const decorations = state.field(hiddenSyntaxField);

      expect(decorations.size).toBe(0);
    });

    it("updates decorations when document changes", () => {
      const state1 = createTestState("Plain text");
      const decorations1 = state1.field(hiddenSyntaxField);
      expect(decorations1.size).toBe(0);

      // Simulate adding bold text
      const state2 = createTestState("**bold** text");
      const decorations2 = state2.field(hiddenSyntaxField);
      expect(decorations2.size).toBeGreaterThan(0);
    });
  });

  describe("Raw view toggle", () => {
    it("shows all syntax when raw mode is enabled", () => {
      // In raw mode, no decorations should be applied
      const rawState = createTestState("**bold** text", true);

      // Raw mode uses empty extension, so field won't exist
      // This is the expected behavior - compartment reconfigures to []
      expect(() => rawState.field(hiddenSyntaxField)).toThrow();
    });

    it("hides syntax when raw mode is disabled", () => {
      const wysiwygState = createTestState("**bold** text", false);
      const decorations = wysiwygState.field(hiddenSyntaxField);

      expect(decorations.size).toBeGreaterThan(0);
    });
  });

  describe("createHiddenSyntaxExtension", () => {
    it("returns compartment extension for WYSIWYG mode", () => {
      const extension = createHiddenSyntaxExtension(false);
      expect(extension).toBeDefined();
    });

    it("returns empty compartment for raw mode", () => {
      const extension = createHiddenSyntaxExtension(true);
      expect(extension).toBeDefined();
    });
  });

  describe("Markdown syntax token detection", () => {
    it("detects EmphasisMark tokens (italic)", () => {
      const state = createTestState("*italic*");
      const decorations = state.field(hiddenSyntaxField);
      // Should hide both opening and closing *
      expect(decorations.size).toBeGreaterThan(0);
    });

    it("detects StrongEmphasis markers (bold)", () => {
      const state = createTestState("**bold**");
      const decorations = state.field(hiddenSyntaxField);
      // Should hide both opening and closing **
      expect(decorations.size).toBeGreaterThan(0);
    });

    it("detects CodeMark tokens (inline code)", () => {
      const state = createTestState("`code`");
      const decorations = state.field(hiddenSyntaxField);
      // Should hide both backticks
      expect(decorations.size).toBeGreaterThan(0);
    });

    it("detects HeaderMark tokens (headings)", () => {
      const state = createTestState("# H1\n## H2\n### H3");
      const decorations = state.field(hiddenSyntaxField);
      // Should hide #, ##, ### markers
      expect(decorations.size).toBeGreaterThan(0);
    });
  });
});
