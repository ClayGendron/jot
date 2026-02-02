/**
 * Harper.js Grammar Checker Instance
 *
 * Manages a singleton Harper.js WorkerLinter instance for grammar checking.
 * Uses WebAssembly for fast, on-device grammar checking.
 */

import {
  WorkerLinter,
  binaryInlined as binary,
  Dialect,
  type Lint,
  type Suggestion,
  type Linter,
} from "harper.js";
import type { GrammarDialect, GrammarIssue } from "./types";
import { DEFAULT_DIALECT } from "./types";

/** The WorkerLinter instance (lazy-loaded) */
let linterInstance: Linter | null = null;

/** Currently active dialect */
let currentDialect: GrammarDialect = DEFAULT_DIALECT;

/** Loading state */
let isLoading = false;

/** Promise for current initialization */
let initPromise: Promise<void> | null = null;

/** Whether initialization has permanently failed (don't retry) */
let loadFailed = false;

/** Set of ignored rule IDs (loaded separately) */
let ignoredRuleIds = new Set<string>();

/**
 * Map our dialect type to Harper's Dialect enum
 */
function getDialectEnum(dialect: GrammarDialect): Dialect {
  const dialectMap: Record<GrammarDialect, Dialect> = {
    american: Dialect.American,
    british: Dialect.British,
    canadian: Dialect.Canadian,
    australian: Dialect.Australian,
  };
  return dialectMap[dialect];
}

/**
 * Initialize the grammar checker with specified dialect
 */
export async function initGrammarChecker(
  dialect: GrammarDialect = DEFAULT_DIALECT
): Promise<void> {
  // Don't retry after permanent failure
  if (loadFailed) {
    return;
  }

  // If already loading, wait for it
  if (isLoading && initPromise) {
    return initPromise;
  }

  // If already initialized with same dialect, nothing to do
  if (linterInstance && currentDialect === dialect) {
    return;
  }

  isLoading = true;
  currentDialect = dialect;

  initPromise = (async () => {
    try {
      // Create new linter instance with WorkerLinter for non-blocking UI
      linterInstance = new WorkerLinter({
        binary,
        dialect: getDialectEnum(dialect),
      });

      // Run setup to ensure WASM is loaded
      await linterInstance.setup();
    } catch (error) {
      // Mark as permanently failed to prevent retry loops
      loadFailed = true;
      linterInstance = null;
      console.error("Grammar checking disabled:", error);
      // Don't throw - graceful degradation means spell check still works
    } finally {
      isLoading = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

/**
 * Check if the grammar checker is ready
 */
export function isGrammarCheckerReady(): boolean {
  return linterInstance !== null && !isLoading;
}

/**
 * Get the current dialect
 */
export function getCurrentDialect(): GrammarDialect {
  return currentDialect;
}

/**
 * Set the ignored rules (from persistent storage)
 */
export function setIgnoredRules(ruleIds: string[]): void {
  ignoredRuleIds = new Set(ruleIds);
}

/**
 * Add a rule to ignored list (in memory only)
 */
export function addIgnoredRuleMemory(ruleId: string): void {
  ignoredRuleIds.add(ruleId);
}

/**
 * Check if a rule is ignored
 */
export function isRuleIgnored(ruleId: string): boolean {
  return ignoredRuleIds.has(ruleId);
}

/**
 * Convert Harper Lint to our GrammarIssue format
 */
function lintToGrammarIssue(lint: Lint, offset: number): GrammarIssue {
  // Extract suggestion strings
  const suggestions: string[] = lint.suggestions().map((s: Suggestion) => {
    return s.get_replacement_text();
  });

  // Get the span for position info
  const span = lint.span();

  return {
    text: lint.get_problem_text(),
    from: offset + span.start,
    to: offset + span.end,
    ruleId: lint.lint_kind(),
    message: lint.message(),
    suggestions: suggestions.filter((s) => s && s.length > 0),
    category: lint.lint_kind_pretty(),
  };
}

/**
 * Check text for grammar issues
 *
 * @param text - The text to check
 * @param offset - Position offset for document integration (default 0)
 * @returns Array of grammar issues found
 */
export async function checkGrammar(
  text: string,
  offset: number = 0
): Promise<GrammarIssue[]> {
  if (!linterInstance) {
    return [];
  }

  try {
    // Use markdown language since we're a markdown editor
    const lints = await linterInstance.lint(text, { language: "markdown" });

    // Convert lints to our format, filtering ignored rules
    const issues: GrammarIssue[] = [];
    for (const lint of lints) {
      const ruleId = lint.lint_kind();

      // Skip ignored rules
      if (ignoredRuleIds.has(ruleId)) {
        continue;
      }

      issues.push(lintToGrammarIssue(lint, offset));
    }

    return issues;
  } catch (error) {
    console.error("Grammar check failed:", error);
    return [];
  }
}

/**
 * Apply a suggestion to fix a grammar issue using Harper's built-in method
 *
 * @param originalText - The original full text
 * @param issue - The grammar issue to fix
 * @param suggestionIndex - Index of the suggestion to apply
 * @returns The corrected text
 */
export async function applySuggestion(
  originalText: string,
  issue: GrammarIssue,
  suggestionText: string
): Promise<string> {
  // Simple string replacement (offset-aware)
  const before = originalText.substring(0, issue.from);
  const after = originalText.substring(issue.to);
  return before + suggestionText + after;
}

/**
 * Get the linter instance (for advanced usage)
 */
export function getLinter(): Linter | null {
  return linterInstance;
}

/**
 * Clean up and destroy the linter instance
 */
export async function destroyGrammarChecker(): Promise<void> {
  if (linterInstance) {
    try {
      await linterInstance.dispose();
    } catch {
      // Ignore cleanup errors
    }
    linterInstance = null;
  }
  isLoading = false;
  initPromise = null;
}

/**
 * Clear the cache (useful for testing)
 */
export function clearCache(): void {
  linterInstance = null;
  isLoading = false;
  initPromise = null;
  ignoredRuleIds.clear();
  loadFailed = false;
}
