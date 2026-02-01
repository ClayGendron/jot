/**
 * Grammar Check Types
 *
 * Type definitions for the grammar checking system.
 */

/**
 * Supported dialects for grammar checking.
 * Harper.js supports various English dialects.
 */
export type GrammarDialect =
  | "american"
  | "british"
  | "canadian"
  | "australian";

/**
 * Dialect metadata for display purposes
 */
export interface DialectInfo {
  code: GrammarDialect;
  name: string;
}

/**
 * All supported dialects with metadata
 */
export const SUPPORTED_DIALECTS: DialectInfo[] = [
  { code: "american", name: "American English" },
  { code: "british", name: "British English" },
  { code: "canadian", name: "Canadian English" },
  { code: "australian", name: "Australian English" },
];

/**
 * Default grammar check dialect
 */
export const DEFAULT_DIALECT: GrammarDialect = "american";

/**
 * A grammar issue found in text
 */
export interface GrammarIssue {
  /** The problematic text */
  text: string;
  /** Start position in the document */
  from: number;
  /** End position in the document */
  to: number;
  /** Rule ID for ignore functionality */
  ruleId: string;
  /** Human-readable explanation */
  message: string;
  /** Suggested corrections */
  suggestions: string[];
  /** Category of the issue (e.g., "passive_voice", "spelling") */
  category: string;
}

/**
 * Ignored rules entry
 */
export interface IgnoredRuleEntry {
  /** The rule ID */
  ruleId: string;
  /** When it was added (Unix timestamp) */
  addedAt: number;
}

/**
 * Ignored rules stored on disk
 */
export interface IgnoredRules {
  /** Schema version for migrations */
  version: number;
  /** Rules in the ignored list */
  rules: IgnoredRuleEntry[];
}

/**
 * Default empty ignored rules
 */
export const DEFAULT_IGNORED_RULES: IgnoredRules = {
  version: 1,
  rules: [],
};
