/**
 * Spell Check Module
 *
 * Exports all spell checking functionality for use in the editor.
 */

// Types
export type {
  SpellCheckLanguage,
  LanguageInfo,
  SpellCheckResult,
  MisspelledWord,
  PersonalDictionary,
  PersonalDictionaryEntry,
} from "./types";

export {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  DEFAULT_PERSONAL_DICTIONARY,
} from "./types";

// Typo.js instance
export {
  initSpellChecker,
  getCurrentLanguage,
  isSpellCheckerReady,
  setPersonalDictionary,
  addToPersonalDictionaryMemory,
  checkWord,
  getSuggestions,
  checkWordWithSuggestions,
  tokenizeText,
  checkText,
  clearCache,
} from "./typoInstance";

// Personal dictionary (Tauri integration)
export {
  loadPersonalDictionary,
  getPersonalDictionary,
  addToPersonalDictionary,
  removeFromPersonalDictionary,
  isInPersonalDictionary,
  getPersonalDictionaryWords,
} from "./personalDictionary";
