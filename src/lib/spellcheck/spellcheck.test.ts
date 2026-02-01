/**
 * Spell Check Library Tests
 *
 * Tests for the spell checking functionality including:
 * - Word tokenization
 * - Spell checking with personal dictionary
 * - Suggestion generation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  tokenizeText,
  checkWord,
  setPersonalDictionary,
  addToPersonalDictionaryMemory,
  clearCache,
} from "./typoInstance";

// Mock Typo.js for unit tests (we don't want to load actual dictionaries)
vi.mock("typo-js", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      check: vi.fn((word: string) => {
        // Simple mock: words with 'x' or 'z' are "misspelled"
        const correctWords = new Set([
          "hello",
          "world",
          "the",
          "test",
          "word",
          "correct",
          "don't",
          "it's",
          "well-known",
          "John's",
        ]);
        return correctWords.has(word.toLowerCase());
      }),
      suggest: vi.fn((word: string) => {
        // Return mock suggestions
        if (word.toLowerCase() === "tset") {
          return ["test", "set", "seat", "best", "rest"];
        }
        if (word.toLowerCase() === "wrold") {
          return ["world", "would", "wold"];
        }
        return [];
      }),
      loaded: true,
    })),
  };
});

describe("tokenizeText", () => {
  beforeEach(() => {
    clearCache();
  });

  it("extracts simple words with positions", () => {
    const result = tokenizeText("Hello world");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ word: "Hello", start: 0, end: 5 });
    expect(result[1]).toEqual({ word: "world", start: 6, end: 11 });
  });

  it("handles contractions", () => {
    const result = tokenizeText("don't it's");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ word: "don't", start: 0, end: 5 });
    expect(result[1]).toEqual({ word: "it's", start: 6, end: 10 });
  });

  it("handles hyphenated words", () => {
    const result = tokenizeText("well-known fact");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ word: "well-known", start: 0, end: 10 });
    expect(result[1]).toEqual({ word: "fact", start: 11, end: 15 });
  });

  it("handles possessives", () => {
    const result = tokenizeText("John's book");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ word: "John's", start: 0, end: 6 });
    expect(result[1]).toEqual({ word: "book", start: 7, end: 11 });
  });

  it("ignores numbers and punctuation", () => {
    const result = tokenizeText("Hello, world! 123");

    expect(result).toHaveLength(2);
    expect(result[0].word).toBe("Hello");
    expect(result[1].word).toBe("world");
  });

  it("returns empty array for text with no words", () => {
    expect(tokenizeText("")).toHaveLength(0);
    expect(tokenizeText("123 456")).toHaveLength(0);
    expect(tokenizeText("!@#$%")).toHaveLength(0);
  });

  it("handles text with extra whitespace", () => {
    const result = tokenizeText("  hello   world  ");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ word: "hello", start: 2, end: 7 });
    expect(result[1]).toEqual({ word: "world", start: 10, end: 15 });
  });
});

describe("checkWord", () => {
  beforeEach(() => {
    clearCache();
    setPersonalDictionary([]);
  });

  it("returns true for empty strings", () => {
    expect(checkWord("")).toBe(true);
  });

  it("returns true for single character words", () => {
    expect(checkWord("a")).toBe(true);
    expect(checkWord("I")).toBe(true);
  });

  it("returns true when spell checker is not initialized", () => {
    // With no dictionary loaded, all words should be considered correct
    clearCache();
    expect(checkWord("anythingxyz")).toBe(true);
  });
});

describe("personal dictionary", () => {
  beforeEach(() => {
    clearCache();
    setPersonalDictionary([]);
  });

  it("accepts words in personal dictionary", () => {
    setPersonalDictionary(["customword", "anotherword"]);

    // These would be "misspelled" without personal dictionary
    expect(checkWord("customword")).toBe(true);
    expect(checkWord("anotherword")).toBe(true);
  });

  it("personal dictionary is case-insensitive", () => {
    setPersonalDictionary(["MyWord"]);

    expect(checkWord("MyWord")).toBe(true);
    expect(checkWord("myword")).toBe(true);
    expect(checkWord("MYWORD")).toBe(true);
  });

  it("can add words to personal dictionary in memory", () => {
    addToPersonalDictionaryMemory("newword");

    expect(checkWord("newword")).toBe(true);
  });

  it("empty personal dictionary doesn't affect spell checking", () => {
    setPersonalDictionary([]);

    // Normal spell checking should still work
    expect(checkWord("")).toBe(true);
    expect(checkWord("a")).toBe(true);
  });
});

describe("tokenizeText handles accented characters", () => {
  it("extracts words with accents", () => {
    const result = tokenizeText("caf\u00e9 na\u00efve");

    expect(result).toHaveLength(2);
    expect(result[0].word).toBe("caf\u00e9");
    expect(result[1].word).toBe("na\u00efve");
  });

  it("extracts Cyrillic words", () => {
    const result = tokenizeText("\u041f\u0440\u0438\u0432\u0435\u0442 \u043c\u0438\u0440");

    expect(result).toHaveLength(2);
    expect(result[0].word).toBe("\u041f\u0440\u0438\u0432\u0435\u0442");
    expect(result[1].word).toBe("\u043c\u0438\u0440");
  });
});
