/**
 * Tests for CodeMirror 6 Spell Check Extension
 *
 * Tests the spell checking functionality including:
 * - Finding misspelled words
 * - Skipping code blocks
 * - Personal dictionary integration
 * - Ignore words for session
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import {
  createSpellCheckExtension,
  getSpellErrors,
  addToIgnored,
  clearIgnored,
  replaceWord,
  refreshSpellCheck,
  type SpellError,
} from "../extensions/spellCheck";

// Mock the spellcheck module
vi.mock("@/lib/spellcheck", () => ({
  isSpellCheckerReady: vi.fn(() => true),
  checkWord: vi.fn((word: string) => {
    // Simple mock: words with "xxx" are misspelled
    const misspelled = ["teh", "wrold", "speling", "eror", "mispeled"];
    return !misspelled.includes(word.toLowerCase());
  }),
  tokenizeText: vi.fn((text: string) => {
    // Simple tokenizer for testing
    const tokens: Array<{ word: string; start: number; end: number }> = [];
    const regex = /\b[a-zA-Z]+\b/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      tokens.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
    return tokens;
  }),
  getSuggestions: vi.fn((word: string) => {
    const suggestions: Record<string, string[]> = {
      teh: ["the", "tea", "ten"],
      wrold: ["world", "would"],
      speling: ["spelling", "spewing"],
    };
    return suggestions[word.toLowerCase()] ?? [];
  }),
  initSpellChecker: vi.fn(() => Promise.resolve()),
  addToPersonalDictionaryMemory: vi.fn(),
  getSentenceContext: vi.fn(() => ({
    isAtSentenceStart: false,
    isAfterTitlePrefix: false,
  })),
}));

// Helper to create editor with spell check extension
function createEditor(doc: string): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [
      markdown(),
      createSpellCheckExtension(),
    ],
  });
  return new EditorView({ state });
}

describe("SpellCheck Extension", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSpellErrors", () => {
    it("finds misspelled words", () => {
      const view = createEditor("teh quick brown fox");
      refreshSpellCheck(view);

      const errors = getSpellErrors(view);
      expect(errors.length).toBe(1);
      expect(errors[0].word).toBe("teh");
    });

    it("finds multiple misspelled words", () => {
      const view = createEditor("teh wrold has speling erors");
      refreshSpellCheck(view);

      const errors = getSpellErrors(view);
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    it("returns empty array for correct text", () => {
      const view = createEditor("the quick brown fox");
      refreshSpellCheck(view);

      const errors = getSpellErrors(view);
      expect(errors.length).toBe(0);
    });

    it("includes word positions", () => {
      const view = createEditor("hello teh world");
      refreshSpellCheck(view);

      const errors = getSpellErrors(view);
      expect(errors.length).toBe(1);
      expect(errors[0].from).toBe(6);
      expect(errors[0].to).toBe(9);
    });
  });

  describe("Code block exclusion", () => {
    it("skips words inside inline code", () => {
      const view = createEditor("the `teh` word");
      refreshSpellCheck(view);

      const errors = getSpellErrors(view);
      // "teh" inside backticks should be skipped
      expect(errors.length).toBe(0);
    });

    it("skips words inside fenced code blocks", () => {
      const view = createEditor("text\n```\nteh wrold\n```\nmore text");
      refreshSpellCheck(view);

      const errors = getSpellErrors(view);
      // Words inside code block should be skipped
      expect(errors.every((e: SpellError) => e.word !== "teh" && e.word !== "wrold")).toBe(true);
    });
  });

  describe("addToIgnored", () => {
    it("removes word from errors after ignoring", () => {
      const view = createEditor("teh quick teh fox");
      refreshSpellCheck(view);

      expect(getSpellErrors(view).length).toBeGreaterThan(0);

      addToIgnored(view, "teh");
      refreshSpellCheck(view);

      const errors = getSpellErrors(view);
      expect(errors.every((e: SpellError) => e.word !== "teh")).toBe(true);
    });

    it("is case insensitive", () => {
      const view = createEditor("Teh quick TEH fox");
      refreshSpellCheck(view);

      addToIgnored(view, "teh");
      refreshSpellCheck(view);

      const errors = getSpellErrors(view);
      expect(errors.length).toBe(0);
    });
  });

  describe("clearIgnored", () => {
    it("restores ignored words to errors", () => {
      const view = createEditor("teh quick fox");
      refreshSpellCheck(view);

      addToIgnored(view, "teh");
      refreshSpellCheck(view);
      expect(getSpellErrors(view).length).toBe(0);

      clearIgnored(view);
      refreshSpellCheck(view);
      expect(getSpellErrors(view).length).toBe(1);
    });
  });

  describe("replaceWord", () => {
    it("replaces misspelled word with suggestion", () => {
      const view = createEditor("teh quick fox");

      replaceWord(view, 0, 3, "the");

      expect(view.state.doc.toString()).toBe("the quick fox");
    });

    it("handles replacement at end of document", () => {
      const view = createEditor("quick teh");

      replaceWord(view, 6, 9, "the");

      expect(view.state.doc.toString()).toBe("quick the");
    });

    it("handles empty replacement", () => {
      const view = createEditor("hello teh world");

      replaceWord(view, 6, 9, "");

      expect(view.state.doc.toString()).toBe("hello  world");
    });
  });

  describe("refreshSpellCheck", () => {
    it("recalculates errors after document change", () => {
      const view = createEditor("hello world");
      refreshSpellCheck(view);
      expect(getSpellErrors(view).length).toBe(0);

      // Simulate document change
      view.dispatch({
        changes: { from: 0, to: 5, insert: "teh" },
      });
      refreshSpellCheck(view);

      expect(getSpellErrors(view).length).toBe(1);
    });
  });

  describe("SpellError interface", () => {
    it("includes all required properties", () => {
      const view = createEditor("teh world");
      refreshSpellCheck(view);

      const errors = getSpellErrors(view);
      expect(errors.length).toBe(1);

      const error = errors[0];
      expect(error).toHaveProperty("word");
      expect(error).toHaveProperty("from");
      expect(error).toHaveProperty("to");
      expect(typeof error.word).toBe("string");
      expect(typeof error.from).toBe("number");
      expect(typeof error.to).toBe("number");
    });
  });

  describe("Multi-line documents", () => {
    it("finds errors across multiple lines", () => {
      const view = createEditor("teh first line\nwrold second line\nthird speling");
      refreshSpellCheck(view);

      const errors = getSpellErrors(view);
      expect(errors.length).toBe(3);
    });

    it("positions are correct across lines", () => {
      const view = createEditor("hello\nteh world");
      refreshSpellCheck(view);

      const errors = getSpellErrors(view);
      expect(errors.length).toBe(1);
      expect(errors[0].from).toBe(6); // After "hello\n"
      expect(errors[0].to).toBe(9);
    });
  });
});
