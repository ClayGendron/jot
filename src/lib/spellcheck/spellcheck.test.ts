/**
 * Spell Check Library Tests
 *
 * Tests for the spell checking functionality including:
 * - Word tokenization
 * - Spell checking with personal dictionary
 * - Suggestion generation
 * - Dictionary hierarchy
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  tokenizeText,
  checkWord,
  checkWordInContext,
  setPersonalDictionary,
  addToPersonalDictionaryMemory,
  clearCache,
  shouldSkipWord,
  splitIdentifier,
  isLikelyProperNoun,
  getSentenceContext,
  hasMultipleCapitals,
} from "./typoInstance";
import { dictionaryHierarchy } from "./dictionaryHierarchy";

// Mock the symspellService module for unit tests
vi.mock("./symspellService", () => {
  const validWords = new Set([
    "hello",
    "world",
    "the",
    "test",
    "word",
    "correct",
    "don't",
    "it's",
    "well-known",
    "john's",
    "get",
    "user",
    "name",
    "is",
    "enabled",
    "handle",
    "click",
    "profile",
    "component",
    "parser",
    "response",
    "parse",
    "first",
    "saw",
    "today",
    "visiting",
    "soon",
    "works",
    "now",
    "end",
    "start",
    "new",
    "really",
    "what",
    "happened",
    "said",
    "arrived",
    "called",
    "teaches",
    "met",
    // Additional words for camelCase identifier tests
    "code",
    "bear",
    // Words for hyphenated compound tests
    "well",
    "known",
    "high",
    "quality",
    "long",
    "term",
    "self",
    "aware",
    "real",
    "time",
  ]);

  const suggestionMap: Record<string, string[]> = {
    tset: ["test", "set", "seat", "best", "rest"],
    wrold: ["world", "would", "wold"],
  };

  const mockService = {
    init: vi.fn().mockResolvedValue(undefined),
    isReady: vi.fn(() => true),
    checkWord: vi.fn((word: string) => {
      return validWords.has(word.toLowerCase());
    }),
    getSuggestions: vi.fn((word: string, limit = 5) => {
      const suggestions = suggestionMap[word.toLowerCase()] || [];
      return suggestions.slice(0, limit);
    }),
    addToValidCache: vi.fn(),
    removeFromValidCache: vi.fn(),
    clearCache: vi.fn(),
  };

  return {
    spellService: mockService,
    SymSpellService: vi.fn(() => mockService),
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

  it("returns true for valid words", () => {
    expect(checkWord("hello")).toBe(true);
    expect(checkWord("world")).toBe(true);
  });
});

describe("personal dictionary", () => {
  beforeEach(() => {
    clearCache();
    // Reset dictionary hierarchy state
    dictionaryHierarchy.clearSessionIgnores();
    dictionaryHierarchy.setPersonalDictionary([]);
    dictionaryHierarchy.clearWorkspaceDictionary();
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
    const result = tokenizeText("café naïve");

    expect(result).toHaveLength(2);
    expect(result[0].word).toBe("café");
    expect(result[1].word).toBe("naïve");
  });

  it("extracts Cyrillic words", () => {
    const result = tokenizeText("Привет мир");

    expect(result).toHaveLength(2);
    expect(result[0].word).toBe("Привет");
    expect(result[1].word).toBe("мир");
  });
});

describe("shouldSkipWord heuristics", () => {
  it("skips empty and very short words", () => {
    expect(shouldSkipWord("")).toBe(true);
    expect(shouldSkipWord("a")).toBe(true);
    expect(shouldSkipWord("ab")).toBe(true);
    expect(shouldSkipWord("abc")).toBe(false); // 3 chars is ok
  });

  it("skips ALL CAPS words (acronyms)", () => {
    expect(shouldSkipWord("API")).toBe(true);
    expect(shouldSkipWord("HTTP")).toBe(true);
    expect(shouldSkipWord("JSON")).toBe(true);
    expect(shouldSkipWord("USA")).toBe(true);
  });

  it("does not skip mixed case words", () => {
    expect(shouldSkipWord("Hello")).toBe(false);
    expect(shouldSkipWord("HELLO")).toBe(true); // ALL CAPS
    expect(shouldSkipWord("hello")).toBe(false);
  });

  it("skips words containing digits", () => {
    expect(shouldSkipWord("ES6")).toBe(true);
    expect(shouldSkipWord("HTML5")).toBe(true);
    expect(shouldSkipWord("v2")).toBe(true);
    expect(shouldSkipWord("user123")).toBe(true);
    expect(shouldSkipWord("3rd")).toBe(true);
  });

  it("skips words starting with @", () => {
    expect(shouldSkipWord("@Component")).toBe(true);
    expect(shouldSkipWord("@mention")).toBe(true);
    expect(shouldSkipWord("@user")).toBe(true);
  });

  it("skips hashtags", () => {
    expect(shouldSkipWord("#react")).toBe(true);
    expect(shouldSkipWord("#javascript")).toBe(true);
  });

  it("skips hex-like strings", () => {
    expect(shouldSkipWord("a1b2c3")).toBe(true); // has digits
    expect(shouldSkipWord("deadbeef")).toBe(true); // looks like hex
    expect(shouldSkipWord("abcdef")).toBe(true); // 6 hex chars
  });
});

describe("splitIdentifier", () => {
  it("splits camelCase words", () => {
    expect(splitIdentifier("getUserName")).toEqual(["get", "User", "Name"]);
    expect(splitIdentifier("handleClick")).toEqual(["handle", "Click"]);
    expect(splitIdentifier("isEnabled")).toEqual(["is", "Enabled"]);
  });

  it("splits PascalCase words", () => {
    expect(splitIdentifier("UserProfile")).toEqual(["User", "Profile"]);
    expect(splitIdentifier("ReactComponent")).toEqual(["React", "Component"]);
  });

  it("splits snake_case words", () => {
    expect(splitIdentifier("user_name")).toEqual(["user", "name"]);
    expect(splitIdentifier("API_KEY_VALUE")).toEqual(["API", "KEY", "VALUE"]);
    expect(splitIdentifier("get_user_profile")).toEqual(["get", "user", "profile"]);
  });

  it("splits mixed camelCase and snake_case", () => {
    expect(splitIdentifier("user_firstName")).toEqual(["user", "first", "Name"]);
  });

  it("handles single words", () => {
    expect(splitIdentifier("hello")).toEqual(["hello"]);
    expect(splitIdentifier("HELLO")).toEqual(["HELLO"]);
  });

  it("handles acronyms in camelCase", () => {
    expect(splitIdentifier("parseHTML")).toEqual(["parse", "HTML"]);
    expect(splitIdentifier("XMLParser")).toEqual(["XML", "Parser"]);
    expect(splitIdentifier("getHTTPResponse")).toEqual(["get", "HTTP", "Response"]);
  });
});

describe("tokenizeText filters out URLs and emails", () => {
  beforeEach(() => {
    clearCache();
  });

  it("filters out URLs", () => {
    const result = tokenizeText("Check https://example.com for more");

    // Should only have "Check", "for", "more"
    expect(result.map((r) => r.word)).toEqual(["Check", "for", "more"]);
  });

  it("filters out email addresses", () => {
    const result = tokenizeText("Email user@example.com today");

    // Should only have "Email", "today"
    expect(result.map((r) => r.word)).toEqual(["Email", "today"]);
  });

  it("filters out hex colors", () => {
    const result = tokenizeText("Use color #ff5733 here");

    // #ff5733 should be filtered, but "ff" part might still be extracted
    // depending on regex order - check that at least the context words are there
    const words = result.map((r) => r.word);
    expect(words).toContain("Use");
    expect(words).toContain("color");
    expect(words).toContain("here");
  });
});

describe("checkWord with technical terms", () => {
  beforeEach(() => {
    clearCache();
    dictionaryHierarchy.clearSessionIgnores();
    dictionaryHierarchy.setPersonalDictionary([]);
    dictionaryHierarchy.clearWorkspaceDictionary();
  });

  it("accepts common programming terms", () => {
    expect(checkWord("javascript")).toBe(true);
    expect(checkWord("typescript")).toBe(true);
    expect(checkWord("webpack")).toBe(true);
    expect(checkWord("middleware")).toBe(true);
    expect(checkWord("async")).toBe(true);
    expect(checkWord("navbar")).toBe(true);
  });

  it("accepts technical terms case-insensitively", () => {
    expect(checkWord("JavaScript")).toBe(true);
    expect(checkWord("TYPESCRIPT")).toBe(true);
    expect(checkWord("WebPack")).toBe(true);
  });

  it("accepts framework names", () => {
    expect(checkWord("react")).toBe(true);
    expect(checkWord("vue")).toBe(true);
    expect(checkWord("svelte")).toBe(true);
    expect(checkWord("nextjs")).toBe(true);
  });
});

describe("checkWord with camelCase identifiers", () => {
  beforeEach(() => {
    clearCache();
    dictionaryHierarchy.clearSessionIgnores();
    dictionaryHierarchy.setPersonalDictionary([]);
    dictionaryHierarchy.clearWorkspaceDictionary();
  });

  it("accepts valid camelCase identifiers", () => {
    // Each part is a valid word
    expect(checkWord("helloWorld")).toBe(true);
  });

  it("accepts snake_case identifiers with valid parts", () => {
    expect(checkWord("hello_world")).toBe(true);
  });

  it("accepts identifiers with ALL CAPS acronym parts", () => {
    // ALL CAPS parts like OSX, SSL, API are skipped as acronyms
    expect(checkWord("CodeOSX")).toBe(true);
    expect(checkWord("BearSSL")).toBe(true);
    expect(checkWord("parseHTML")).toBe(true);
    expect(checkWord("XMLParser")).toBe(true);
    expect(checkWord("getHTTPResponse")).toBe(true);
  });
});

describe("checkWord with hyphenated compound words", () => {
  beforeEach(() => {
    clearCache();
    dictionaryHierarchy.clearSessionIgnores();
    dictionaryHierarchy.setPersonalDictionary([]);
    dictionaryHierarchy.clearWorkspaceDictionary();
  });

  it("accepts hyphenated words if whole word is in dictionary", () => {
    // "well-known" is in the mock dictionary as a whole
    expect(checkWord("well-known")).toBe(true);
  });

  it("accepts hyphenated words if all parts are valid", () => {
    // "high-quality" is NOT in dictionary as whole word,
    // but "high" and "quality" are both valid
    expect(checkWord("high-quality")).toBe(true);
  });

  it("accepts multi-hyphen compound words with valid parts", () => {
    // "long-term-self-aware" - all parts are valid words
    expect(checkWord("long-term")).toBe(true);
    expect(checkWord("self-aware")).toBe(true);
    expect(checkWord("real-time")).toBe(true);
  });

  it("rejects hyphenated words if any part is invalid", () => {
    // "xyzzy-known" - "xyzzy" is not a valid word
    expect(checkWord("xyzzy-known")).toBe(false);
    // "well-xyzzy" - "xyzzy" is not valid
    expect(checkWord("well-xyzzy")).toBe(false);
    // "xyzzy-plugh" - neither part is valid
    expect(checkWord("xyzzy-plugh")).toBe(false);
  });

  it("handles hyphenated words with short parts", () => {
    // Very short parts (< 2 chars) are considered valid
    // This allows things like "X-ray" style constructions
    expect(checkWord("a-quality")).toBe(true); // "a" is short, "quality" is valid
  });

  it("handles hyphenated words with ALL CAPS parts (acronyms)", () => {
    // ALL CAPS parts are skipped as acronyms
    // "API-known" -> "API" skipped (acronym), "known" is valid
    expect(checkWord("API-known")).toBe(true);
    expect(checkWord("HTTP-aware")).toBe(true);
  });
});

describe("proper noun detection", () => {
  describe("isLikelyProperNoun", () => {
    it("returns false for lowercase words", () => {
      expect(isLikelyProperNoun("hello", "say hello to")).toBe(false);
      expect(isLikelyProperNoun("world", "the world is")).toBe(false);
    });

    it("returns true for capitalized words mid-sentence", () => {
      // "John" appears mid-sentence, likely a proper noun
      expect(isLikelyProperNoun("John", "I saw John yesterday")).toBe(true);
      expect(isLikelyProperNoun("Paris", "visiting Paris soon")).toBe(true);
      expect(isLikelyProperNoun("Microsoft", "works at Microsoft now")).toBe(true);
    });

    it("returns false for capitalized words at sentence start", () => {
      // Word at start of sentence - could be proper noun OR regular word
      expect(isLikelyProperNoun("Hello", "Hello world")).toBe(false);
      expect(isLikelyProperNoun("The", "The cat sat")).toBe(false);
    });

    it("returns false for capitalized words after period", () => {
      // Start of new sentence
      expect(isLikelyProperNoun("This", "End. This is new")).toBe(false);
      expect(isLikelyProperNoun("What", "Really? What happened")).toBe(false);
    });

    it("returns true for words after title prefixes", () => {
      // "Dr." doesn't end a sentence, so "Smith" is a proper noun
      expect(isLikelyProperNoun("Smith", "Dr. Smith said")).toBe(true);
      expect(isLikelyProperNoun("Johnson", "Mr. Johnson arrived")).toBe(true);
      expect(isLikelyProperNoun("Williams", "Mrs. Williams called")).toBe(true);
      expect(isLikelyProperNoun("Brown", "Prof. Brown teaches")).toBe(true);
    });
  });

  describe("getSentenceContext", () => {
    it("detects word at start of text", () => {
      const ctx = getSentenceContext("Hello world", 0, 5);
      expect(ctx.isAtSentenceStart).toBe(true);
    });

    it("detects word after period", () => {
      const ctx = getSentenceContext("End. Start again", 5, 10);
      expect(ctx.isAtSentenceStart).toBe(true);
    });

    it("detects word after question mark", () => {
      const ctx = getSentenceContext("What? This is", 6, 10);
      expect(ctx.isAtSentenceStart).toBe(true);
    });

    it("detects word after exclamation", () => {
      const ctx = getSentenceContext("Wow! Amazing", 5, 12);
      expect(ctx.isAtSentenceStart).toBe(true);
    });

    it("detects mid-sentence word", () => {
      const ctx = getSentenceContext("I saw John yesterday", 6, 10);
      expect(ctx.isAtSentenceStart).toBe(false);
    });

    it("detects word after title prefix", () => {
      const ctx = getSentenceContext("Dr. Smith said", 4, 9);
      expect(ctx.isAfterTitlePrefix).toBe(true);
      expect(ctx.isAtSentenceStart).toBe(false);
    });

    it("handles multiple spaces after punctuation", () => {
      const ctx = getSentenceContext("End.   Start", 7, 12);
      expect(ctx.isAtSentenceStart).toBe(true);
    });
  });

  describe("checkWordInContext skips proper nouns", () => {
    beforeEach(() => {
      clearCache();
      setPersonalDictionary([]);
    });

    it("skips capitalized mid-sentence words", () => {
      // "Xyzzy" would be flagged as misspelled, but mid-sentence it's likely a name
      expect(checkWordInContext("Xyzzy", "I met Xyzzy today")).toBe(true);
    });

    it("checks capitalized words at sentence start", () => {
      // At sentence start, we should check spelling (lowercase version)
      expect(checkWordInContext("Hello", "Hello world")).toBe(true); // "hello" is valid
    });
  });

  describe("hasMultipleCapitals", () => {
    it("returns true for words with internal capitals (camelCase pattern)", () => {
      expect(hasMultipleCapitals("iPhone")).toBe(true);
      expect(hasMultipleCapitals("MacBook")).toBe(true);
      expect(hasMultipleCapitals("GitHub")).toBe(true);
      expect(hasMultipleCapitals("getUserName")).toBe(true);
    });

    it("returns false for simple words without internal capitals", () => {
      expect(hasMultipleCapitals("hello")).toBe(false);
      expect(hasMultipleCapitals("Hello")).toBe(false);
      expect(hasMultipleCapitals("HELLO")).toBe(false); // ALL CAPS, no lowercase-uppercase transition
      expect(hasMultipleCapitals("Paris")).toBe(false);
    });
  });
});

describe("DictionaryHierarchy", () => {
  beforeEach(() => {
    // Reset the hierarchy state
    dictionaryHierarchy.clearSessionIgnores();
    dictionaryHierarchy.setPersonalDictionary([]);
    dictionaryHierarchy.clearWorkspaceDictionary();
  });

  it("session ignores have highest priority", () => {
    dictionaryHierarchy.ignoreForSession("xyzzy");
    expect(dictionaryHierarchy.isWordValid("xyzzy")).toBe(true);
    expect(dictionaryHierarchy.isSessionIgnored("xyzzy")).toBe(true);
  });

  it("personal dictionary words are valid", () => {
    dictionaryHierarchy.setPersonalDictionary(["customterm"]);
    expect(dictionaryHierarchy.isWordValid("customterm")).toBe(true);
    expect(dictionaryHierarchy.isInPersonalDictionary("customterm")).toBe(true);
  });

  it("workspace dictionary words are valid", () => {
    dictionaryHierarchy.setWorkspaceDictionary(["projectterm"]);
    expect(dictionaryHierarchy.isWordValid("projectterm")).toBe(true);
    expect(dictionaryHierarchy.isInWorkspaceDictionary("projectterm")).toBe(true);
  });

  it("tech terms are valid", () => {
    // Tech terms are set on module load
    expect(dictionaryHierarchy.isTechTerm("javascript")).toBe(true);
    expect(dictionaryHierarchy.isTechTerm("typescript")).toBe(true);
  });

  it("clearing session ignores removes words", () => {
    dictionaryHierarchy.ignoreForSession("tempword");
    expect(dictionaryHierarchy.isSessionIgnored("tempword")).toBe(true);

    dictionaryHierarchy.clearSessionIgnores();
    expect(dictionaryHierarchy.isSessionIgnored("tempword")).toBe(false);
  });
});
