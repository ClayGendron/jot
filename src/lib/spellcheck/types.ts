/**
 * Spell Check Types
 *
 * Type definitions for the spell checking system.
 */

/**
 * Supported languages for spell checking.
 * Languages use Hunspell dictionary format.
 */
export type SpellCheckLanguage =
  // Western European
  | "en_US"
  | "en_GB"
  | "es_ES"
  | "fr_FR"
  | "de_DE"
  | "pt_BR"
  | "pt_PT"
  | "it_IT"
  | "nl_NL"
  // Eastern European
  | "pl_PL"
  | "ru_RU"
  | "uk_UA"
  | "cs_CZ"
  // Nordic
  | "sv_SE"
  | "da_DK"
  | "nb_NO";

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
  // Western European
  { code: "en_US", name: "English (US)", nativeName: "English (US)" },
  { code: "en_GB", name: "English (UK)", nativeName: "English (UK)" },
  { code: "es_ES", name: "Spanish", nativeName: "Espa\u00f1ol" },
  { code: "fr_FR", name: "French", nativeName: "Fran\u00e7ais" },
  { code: "de_DE", name: "German", nativeName: "Deutsch" },
  { code: "pt_BR", name: "Portuguese (BR)", nativeName: "Portugu\u00eas (BR)" },
  { code: "pt_PT", name: "Portuguese (PT)", nativeName: "Portugu\u00eas (PT)" },
  { code: "it_IT", name: "Italian", nativeName: "Italiano" },
  { code: "nl_NL", name: "Dutch", nativeName: "Nederlands" },
  // Eastern European
  { code: "pl_PL", name: "Polish", nativeName: "Polski" },
  { code: "ru_RU", name: "Russian", nativeName: "\u0420\u0443\u0441\u0441\u043a\u0438\u0439" },
  { code: "uk_UA", name: "Ukrainian", nativeName: "\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430" },
  { code: "cs_CZ", name: "Czech", nativeName: "\u010ce\u0161tina" },
  // Nordic
  { code: "sv_SE", name: "Swedish", nativeName: "Svenska" },
  { code: "da_DK", name: "Danish", nativeName: "Dansk" },
  { code: "nb_NO", name: "Norwegian", nativeName: "Norsk" },
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
