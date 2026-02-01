/**
 * Grammar Check Module
 *
 * Exports all grammar checking functionality for use in the editor.
 */

// Types
export type {
  GrammarDialect,
  DialectInfo,
  GrammarIssue,
  IgnoredRuleEntry,
  IgnoredRules,
} from "./types";

export {
  SUPPORTED_DIALECTS,
  DEFAULT_DIALECT,
  DEFAULT_IGNORED_RULES,
} from "./types";

// Harper.js instance
export {
  initGrammarChecker,
  isGrammarCheckerReady,
  getCurrentDialect,
  setIgnoredRules,
  addIgnoredRuleMemory,
  isRuleIgnored,
  checkGrammar,
  applySuggestion,
  getLinter,
  destroyGrammarChecker,
  clearCache,
} from "./harperInstance";

// Ignored rules (Tauri integration)
export {
  loadIgnoredRules,
  getIgnoredRules,
  addIgnoredRule,
  removeIgnoredRule,
  isRuleInIgnoredList,
  getIgnoredRuleIds,
} from "./ignoredRules";
