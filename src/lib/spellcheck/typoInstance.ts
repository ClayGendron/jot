/**
 * Typo.js Spell Checker Instance
 *
 * Manages a singleton Typo.js instance with lazy dictionary loading.
 * Provides checkWord and getSuggestions functions.
 */

import Typo from "typo-js";
import type { SpellCheckLanguage, SpellCheckResult } from "./types";
import { DEFAULT_LANGUAGE } from "./types";

/** Maximum number of suggestions to return */
const MAX_SUGGESTIONS = 8;

/** Cache of loaded Typo instances by language */
const typoCache = new Map<SpellCheckLanguage, Typo>();

/** Currently active language */
let currentLanguage: SpellCheckLanguage = DEFAULT_LANGUAGE;

/** Currently active Typo instance */
let currentTypo: Typo | null = null;

/** Loading state */
let isLoading = false;

/** Promise for current loading operation */
let loadingPromise: Promise<void> | null = null;

/** Personal dictionary words (loaded separately) */
let personalDictionaryWords = new Set<string>();

/**
 * Regex to tokenize text into words.
 * Handles:
 * - Basic words
 * - Contractions (don't, it's)
 * - Hyphenated words (well-known)
 * - Possessives (John's)
 */
const WORD_REGEX = /[a-zA-Z\u00C0-\u024F\u0400-\u04FF]+(?:[''][a-zA-Z]+)?(?:-[a-zA-Z]+)*/g;

/**
 * Load a dictionary for the specified language
 */
async function loadDictionary(language: SpellCheckLanguage): Promise<Typo> {
  // Check cache first
  const cached = typoCache.get(language);
  if (cached) {
    return cached;
  }

  // Fetch dictionary files from public directory
  const basePath = `/dictionaries/${language}`;

  try {
    const [affResponse, dicResponse] = await Promise.all([
      fetch(`${basePath}/${language}.aff`),
      fetch(`${basePath}/${language}.dic`),
    ]);

    if (!affResponse.ok || !dicResponse.ok) {
      throw new Error(`Failed to load dictionary for ${language}`);
    }

    const [affData, dicData] = await Promise.all([
      affResponse.text(),
      dicResponse.text(),
    ]);

    // Create Typo instance with loaded dictionary data
    const typo = new Typo(language, affData, dicData);

    // Cache for future use
    typoCache.set(language, typo);

    return typo;
  } catch (error) {
    console.error(`Failed to load spell check dictionary for ${language}:`, error);
    throw error;
  }
}

/**
 * Initialize or change the spell checker language
 */
export async function initSpellChecker(
  language: SpellCheckLanguage = DEFAULT_LANGUAGE
): Promise<void> {
  // If already loading this language, wait for it
  if (isLoading && currentLanguage === language && loadingPromise) {
    return loadingPromise;
  }

  // If already loaded this language, nothing to do
  if (currentTypo && currentLanguage === language) {
    return;
  }

  isLoading = true;
  currentLanguage = language;

  loadingPromise = (async () => {
    try {
      currentTypo = await loadDictionary(language);
    } finally {
      isLoading = false;
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/**
 * Get the current spell checker language
 */
export function getCurrentLanguage(): SpellCheckLanguage {
  return currentLanguage;
}

/**
 * Check if the spell checker is ready
 */
export function isSpellCheckerReady(): boolean {
  const ready = currentTypo !== null && !isLoading;
  return ready;
}

/**
 * Set the personal dictionary words
 * These words will be considered correct in addition to dictionary words
 */
export function setPersonalDictionary(words: string[]): void {
  personalDictionaryWords = new Set(words.map((w) => w.toLowerCase()));
}

/**
 * Add a word to the personal dictionary (in memory)
 * Note: This doesn't persist - use personalDictionary.ts for persistence
 */
export function addToPersonalDictionaryMemory(word: string): void {
  personalDictionaryWords.add(word.toLowerCase());
}

/**
 * Check if a word is spelled correctly
 */
export function checkWord(word: string): boolean {
  // Empty or very short words are considered correct
  if (!word || word.length < 2) {
    return true;
  }

  // Check personal dictionary first (case-insensitive)
  if (personalDictionaryWords.has(word.toLowerCase())) {
    return true;
  }

  // If spell checker not ready, assume correct
  if (!currentTypo) {
    return true;
  }

  // Check the dictionary
  return currentTypo.check(word);
}

/**
 * Get spelling suggestions for a word
 */
export function getSuggestions(word: string): string[] {
  if (!currentTypo || !word) {
    return [];
  }

  const suggestions = currentTypo.suggest(word);
  return suggestions.slice(0, MAX_SUGGESTIONS);
}

/**
 * Check a word and get full result with suggestions
 */
export function checkWordWithSuggestions(word: string): SpellCheckResult {
  const correct = checkWord(word);

  return {
    word,
    correct,
    suggestions: correct ? [] : getSuggestions(word),
  };
}

/**
 * Tokenize text into words with their positions
 */
export function tokenizeText(
  text: string
): Array<{ word: string; start: number; end: number }> {
  const words: Array<{ word: string; start: number; end: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = WORD_REGEX.exec(text)) !== null) {
    words.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return words;
}

/**
 * Check all words in a text and return misspelled ones
 */
export function checkText(
  text: string
): Array<{ word: string; start: number; end: number }> {
  const tokens = tokenizeText(text);
  return tokens.filter((token) => !checkWord(token.word));
}

/**
 * Clear the dictionary cache (useful for testing)
 */
export function clearCache(): void {
  typoCache.clear();
  currentTypo = null;
  isLoading = false;
  loadingPromise = null;
}
