/**
 * Spell Check Types
 *
 * Type definitions for the spell checking system.
 */

/**
 * Supported languages for spell checking.
 *
 * Currently locked to en_US only. Multi-language support planned for future.
 * TODO: Add additional languages when SCOWL variants are downloaded and UI is built.
 */
export type SpellCheckLanguage = "en_US";

/**
 * Language metadata for display purposes
 */
export interface LanguageInfo {
  code: SpellCheckLanguage;
  name: string;
  nativeName: string;
}

/**
 * All supported languages with metadata
 */
export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: "en_US", name: "English (US)", nativeName: "English (US)" },
];

/**
 * Default spell check language
 */
export const DEFAULT_LANGUAGE: SpellCheckLanguage = "en_US";

/**
 * Result of checking a word
 */
export interface SpellCheckResult {
  /** The word that was checked */
  word: string;
  /** Whether the word is spelled correctly */
  correct: boolean;
  /** Suggested corrections (if incorrect) */
  suggestions: string[];
}

/**
 * A misspelled word with its position in the document
 */
export interface MisspelledWord {
  /** The misspelled word */
  word: string;
  /** Start position in the document */
  from: number;
  /** End position in the document */
  to: number;
}

/**
 * Personal dictionary entry
 */
export interface PersonalDictionaryEntry {
  /** The word */
  word: string;
  /** When it was added (Unix timestamp) */
  addedAt: number;
}

/**
 * Personal dictionary stored on disk
 */
export interface PersonalDictionary {
  /** Schema version for migrations */
  version: number;
  /** Words in the personal dictionary */
  words: PersonalDictionaryEntry[];
}

/**
 * Default empty personal dictionary
 */
export const DEFAULT_PERSONAL_DICTIONARY: PersonalDictionary = {
  version: 1,
  words: [],
};
