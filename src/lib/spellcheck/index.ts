/**
 * Spell Check Module
 *
 * Exports all spell checking functionality for use in the editor.
 * Uses SymSpell algorithm for sub-millisecond spell checking.
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

// Spell checker core (SymSpell-based)
export {
  initSpellChecker,
  getCurrentLanguage,
  isSpellCheckerReady,
  setPersonalDictionary,
  addToPersonalDictionaryMemory,
  checkWord,
  checkWordInContext,
  getSuggestions,
  checkWordWithSuggestions,
  tokenizeText,
  checkText,
  clearCache,
  // Proper noun detection
  getSentenceContext,
  isLikelyProperNoun,
  hasMultipleCapitals,
} from "./typoInstance";

export type { SentenceContext } from "./typoInstance";

// SymSpell service (low-level access)
export { spellService, SymSpellService } from "./symspellService";

// Dictionary hierarchy
export { dictionaryHierarchy, DictionaryHierarchy } from "./dictionaryHierarchy";

// Personal dictionary (Tauri integration)
export {
  loadPersonalDictionary,
  getPersonalDictionary,
  addToPersonalDictionary,
  removeFromPersonalDictionary,
  isInPersonalDictionary,
  getPersonalDictionaryWords,
} from "./personalDictionary";
