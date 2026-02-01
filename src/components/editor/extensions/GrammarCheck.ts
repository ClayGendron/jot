/**
 * GrammarCheck TipTap Extension
 *
 * Provides grammar checking functionality with:
 * - Cyan wavy underline on grammar issues via ProseMirror decorations
 * - Code block exclusion (no grammar checking inside code)
 * - Integration with Harper.js and ignored rules
 * - Debounced checking for performance
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  checkGrammar,
  initGrammarChecker,
  isGrammarCheckerReady,
  addIgnoredRuleMemory,
} from "@/lib/grammarcheck";
import type { GrammarDialect, GrammarIssue } from "@/lib/grammarcheck";

export interface GrammarCheckOptions {
  /** CSS class for grammar errors */
  grammarErrorClass: string;
  /** Dialect for grammar checking */
  dialect: GrammarDialect;
  /** Whether grammar checking is enabled */
  enabled: boolean;
  /** Debounce delay in ms (grammar checking is heavier than spell check) */
  debounceMs: number;
}

export interface GrammarCheckStorage {
  /** Current dialect */
  dialect: GrammarDialect;
  /** Whether grammar checking is enabled */
  enabled: boolean;
  /** List of grammar issues with positions */
  issues: GrammarIssue[];
  /** Rule IDs to ignore for this session */
  ignoredRules: Set<string>;
  /** Specific issues to ignore for this session (keyed by from-to) */
  ignoredIssues: Set<string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    grammarCheck: {
      /**
       * Enable grammar checking
       */
      enableGrammarCheck: () => ReturnType;

      /**
       * Disable grammar checking
       */
      disableGrammarCheck: () => ReturnType;

      /**
       * Set grammar check dialect
       */
      setGrammarDialect: (dialect: GrammarDialect) => ReturnType;

      /**
       * Ignore a specific grammar issue for this session
       */
      ignoreGrammarIssue: (from: number, to: number) => ReturnType;

      /**
       * Ignore a grammar rule for this session (in memory only)
       */
      ignoreGrammarRuleSession: (ruleId: string) => ReturnType;

      /**
       * Apply a grammar fix
       */
      applyGrammarFix: (from: number, to: number, replacement: string) => ReturnType;

      /**
       * Force a grammar check refresh
       */
      refreshGrammarCheck: () => ReturnType;
    };
  }
}

export const GrammarCheckPluginKey = new PluginKey("grammarCheck");

/**
 * Check if a position is inside a code block or inline code
 */
function isInsideCode(doc: ProseMirrorNode, pos: number): boolean {
  const $pos = doc.resolve(pos);

  // Check if any ancestor is a code block
  for (let depth = $pos.depth; depth >= 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === "codeBlock" || node.type.name === "code") {
      return true;
    }
  }

  // Check if the current mark is code
  const marks = doc.resolve(pos).marks();
  return marks.some((mark) => mark.type.name === "code");
}

/**
 * Extract all text from the document with position mapping
 */
function extractTextWithPositions(
  doc: ProseMirrorNode
): { text: string; offset: number }[] {
  const segments: { text: string; offset: number }[] = [];

  doc.descendants((node, pos) => {
    // Only process text nodes
    if (!node.isText || !node.text) {
      return;
    }

    // Skip if inside code block
    if (isInsideCode(doc, pos)) {
      return;
    }

    segments.push({
      text: node.text,
      offset: pos,
    });
  });

  return segments;
}

/**
 * Find all grammar issues in the document
 */
async function findGrammarIssues(
  doc: ProseMirrorNode,
  ignoredRules: Set<string>,
  ignoredIssues: Set<string>
): Promise<GrammarIssue[]> {
  if (!isGrammarCheckerReady()) {
    return [];
  }

  const issues: GrammarIssue[] = [];
  const segments = extractTextWithPositions(doc);

  // Check each text segment
  for (const segment of segments) {
    const segmentIssues = await checkGrammar(segment.text, segment.offset);

    for (const issue of segmentIssues) {
      // Skip ignored rules
      if (ignoredRules.has(issue.ruleId)) {
        continue;
      }

      // Skip ignored issues (by position)
      const issueKey = `${issue.from}-${issue.to}`;
      if (ignoredIssues.has(issueKey)) {
        continue;
      }

      issues.push(issue);
    }
  }

  return issues;
}

/**
 * Create decorations for grammar issues
 */
function createDecorations(
  doc: ProseMirrorNode,
  issues: GrammarIssue[],
  errorClass: string
): DecorationSet {
  const decorations = issues.map((issue) =>
    Decoration.inline(issue.from, issue.to, {
      class: errorClass,
      "data-grammar-error": "true",
      "data-rule-id": issue.ruleId,
      "data-message": issue.message,
      "data-category": issue.category,
    })
  );

  return DecorationSet.create(doc, decorations);
}

export const GrammarCheck = Extension.create<GrammarCheckOptions, GrammarCheckStorage>({
  name: "grammarCheck",

  addOptions() {
    return {
      grammarErrorClass: "grammar-error",
      dialect: "american",
      enabled: true,
      debounceMs: 300,
    };
  },

  addStorage() {
    return {
      dialect: this.options.dialect,
      enabled: this.options.enabled,
      issues: [],
      ignoredRules: new Set(),
      ignoredIssues: new Set(),
    };
  },

  onCreate() {
    // Initialize grammar checker with configured dialect
    if (this.storage.enabled) {
      initGrammarChecker(this.storage.dialect)
        .then(() => {
          // Force a transaction to trigger decoration refresh after init
          this.editor.view.dispatch(this.editor.state.tr);
        })
        .catch(console.error);
    }
  },

  addCommands() {
    return {
      enableGrammarCheck:
        () =>
        ({ editor, tr }) => {
          this.storage.enabled = true;

          // Initialize grammar checker if not ready
          initGrammarChecker(this.storage.dialect)
            .then(() => {
              // Refresh decorations
              editor.view.dispatch(tr);
            })
            .catch(console.error);

          return true;
        },

      disableGrammarCheck:
        () =>
        ({ editor, tr }) => {
          this.storage.enabled = false;
          this.storage.issues = [];

          // Force view update to remove decorations
          editor.view.dispatch(tr);

          return true;
        },

      setGrammarDialect:
        (dialect: GrammarDialect) =>
        ({ editor, tr }) => {
          this.storage.dialect = dialect;

          // Load new dialect
          initGrammarChecker(dialect)
            .then(() => {
              // Refresh decorations with new dialect
              editor.view.dispatch(tr);
            })
            .catch(console.error);

          return true;
        },

      ignoreGrammarIssue:
        (from: number, to: number) =>
        ({ editor, tr }) => {
          // Add to session-only ignored issues
          const issueKey = `${from}-${to}`;
          this.storage.ignoredIssues.add(issueKey);

          // Remove from issues
          this.storage.issues = this.storage.issues.filter(
            (i) => i.from !== from || i.to !== to
          );

          // Refresh decorations
          editor.view.dispatch(tr);

          return true;
        },

      ignoreGrammarRuleSession:
        (ruleId: string) =>
        ({ editor, tr }) => {
          // Add to session-only ignored rules
          this.storage.ignoredRules.add(ruleId);

          // Also update in-memory set
          addIgnoredRuleMemory(ruleId);

          // Remove matching issues
          this.storage.issues = this.storage.issues.filter(
            (i) => i.ruleId !== ruleId
          );

          // Refresh decorations
          editor.view.dispatch(tr);

          return true;
        },

      applyGrammarFix:
        (from: number, to: number, replacement: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.insertText(replacement, from, to);
            dispatch(tr);
          }

          return true;
        },

      refreshGrammarCheck:
        () =>
        ({ editor, tr }) => {
          // Force recalculation of grammar issues
          findGrammarIssues(
            tr.doc,
            this.storage.ignoredRules,
            this.storage.ignoredIssues
          ).then((issues) => {
            this.storage.issues = issues;
            editor.view.dispatch(tr);
          });

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const { grammarErrorClass, debounceMs } = this.options;
    const storage = this.storage;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pendingCheck = false;

    return [
      new Plugin({
        key: GrammarCheckPluginKey,

        state: {
          init() {
            // Start with empty decorations - will populate after async check
            return DecorationSet.empty;
          },

          apply(tr, oldDecorations, _oldState, newState) {
            // If grammar check is disabled, return empty decorations
            if (!storage.enabled) {
              return DecorationSet.empty;
            }

            // If not ready, return empty decorations
            if (!isGrammarCheckerReady()) {
              return DecorationSet.empty;
            }

            // If document changed, map existing decorations and schedule recheck
            if (tr.docChanged) {
              // Map existing decorations to new positions
              const mapped = oldDecorations.map(tr.mapping, tr.doc);

              // Schedule debounced recheck
              if (debounceTimer) {
                clearTimeout(debounceTimer);
              }

              if (!pendingCheck) {
                pendingCheck = true;
                debounceTimer = setTimeout(() => {
                  pendingCheck = false;
                  // Run grammar check asynchronously
                  findGrammarIssues(
                    newState.doc,
                    storage.ignoredRules,
                    storage.ignoredIssues
                  ).then((issues) => {
                    storage.issues = issues;
                    // Get the editor view from the plugin state
                    // We need to dispatch a transaction to update decorations
                    // This is handled by the command system
                  });
                }, debounceMs);
              }

              return mapped;
            }

            // If we have issues, create decorations
            if (storage.issues.length > 0) {
              return createDecorations(
                newState.doc,
                storage.issues,
                grammarErrorClass
              );
            }

            // No changes - keep existing or return empty
            return oldDecorations;
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

/**
 * Get grammar issue at a position
 */
export function getGrammarIssueAt(
  issues: GrammarIssue[],
  pos: number
): GrammarIssue | undefined {
  return issues.find((issue) => pos >= issue.from && pos <= issue.to);
}

export default GrammarCheck;
