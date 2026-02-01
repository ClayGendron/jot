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
import { getChangedRanges, type Range } from "@/lib/proofing";
import { tokenizeText } from "@/lib/spellcheck";

export interface GrammarCheckOptions {
  /** CSS class for grammar errors */
  grammarErrorClass: string;
  /** Dialect for grammar checking */
  dialect: GrammarDialect;
  /** Whether grammar checking is enabled */
  enabled: boolean;
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

/** Delay before checking a word after typing stops */
const WORD_DEBOUNCE_MS = 500;

/** Counter for generating unique pending word IDs */
let nextGrammarPendingId = 0;

/** A word that was recently modified and hasn't been checked yet */
interface PendingWord {
  id: number;
  from: number;
  to: number;
  word: string;
  timerId: ReturnType<typeof setTimeout>;
}

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

/**
 * Create decorations excluding words that are currently pending (being typed)
 * Uses overlap-based filtering to handle position shifts correctly
 */
function createDecorationsExcludingPending(
  doc: ProseMirrorNode,
  issues: GrammarIssue[],
  errorClass: string,
  pendingWords: Map<number, PendingWord>
): DecorationSet {
  // Filter out issues that overlap with pending words
  const visibleIssues = issues.filter((issue) => {
    for (const pending of pendingWords.values()) {
      // Check for overlap between issue and pending word
      if (issue.to >= pending.from && issue.from <= pending.to) {
        return false; // Hide - user is typing this word
      }
    }
    return true;
  });
  return createDecorations(doc, visibleIssues, errorClass);
}

/**
 * Find words that overlap with the given ranges
 */
function findWordsInRanges(
  doc: ProseMirrorNode,
  ranges: Range[]
): Array<{ word: string; from: number; to: number }> {
  const words: Array<{ word: string; from: number; to: number }> = [];

  for (const range of ranges) {
    doc.nodesBetween(range.from, range.to, (node, pos) => {
      if (!node.isText || !node.text) return;
      if (isInsideCode(doc, pos)) return;

      const tokens = tokenizeText(node.text);
      for (const token of tokens) {
        const wordFrom = pos + token.start;
        const wordTo = pos + token.end;
        // Include if overlaps with changed range
        if (wordTo >= range.from && wordFrom <= range.to) {
          words.push({ word: token.word, from: wordFrom, to: wordTo });
        }
      }
    });
  }

  return words;
}

export const GrammarCheck = Extension.create<GrammarCheckOptions, GrammarCheckStorage>({
  name: "grammarCheck",

  addOptions() {
    return {
      grammarErrorClass: "grammar-error",
      dialect: "american",
      enabled: true,
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
    const { grammarErrorClass } = this.options;
    const storage = this.storage;
    const editor = this.editor;

    // Track pending words (recently modified, not yet checked)
    // Use numeric IDs as keys for stability across position shifts
    const pendingWords = new Map<number, PendingWord>();

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

            // Handle debounce completion signal
            const meta = tr.getMeta(GrammarCheckPluginKey);
            if (meta?.type === "checkComplete") {
              const pendingId = meta.pendingId as number;
              pendingWords.delete(pendingId);
              // Create decorations excluding remaining pending words
              return createDecorationsExcludingPending(
                newState.doc,
                storage.issues,
                grammarErrorClass,
                pendingWords
              );
            }

            // Handle async grammar check completion
            if (meta?.type === "grammarCheckDone") {
              return createDecorationsExcludingPending(
                newState.doc,
                storage.issues,
                grammarErrorClass,
                pendingWords
              );
            }

            // Handle init signal (grammar checker just became ready)
            const needsFullCheck =
              oldDecorations === DecorationSet.empty &&
              storage.issues.length === 0;

            if (!tr.docChanged) {
              if (needsFullCheck) {
                // Grammar checker just became ready - run full check
                findGrammarIssues(
                  newState.doc,
                  storage.ignoredRules,
                  storage.ignoredIssues
                ).then((issues) => {
                  storage.issues = issues;
                  if (editor?.view) {
                    editor.view.dispatch(
                      editor.state.tr.setMeta(GrammarCheckPluginKey, {
                        type: "grammarCheckDone",
                      })
                    );
                  }
                });
              }
              // No document change - keep existing decorations
              return oldDecorations;
            }

            // Document changed - find affected words and mark them as pending

            // 1. Get changed ranges
            const changedRanges = getChangedRanges(tr);

            // 2. Find words overlapping changed ranges
            const affectedWords = findWordsInRanges(newState.doc, changedRanges);

            // 3. For each affected word, clear any overlapping pending word and create new one
            const newlyAddedIds = new Set<number>();
            for (const word of affectedWords) {
              // Find and clear any existing pending word that overlaps
              for (const [id, pending] of pendingWords) {
                if (word.to >= pending.from && word.from <= pending.to) {
                  clearTimeout(pending.timerId);
                  pendingWords.delete(id);
                  break;
                }
              }

              // Create new pending word with unique ID
              const id = nextGrammarPendingId++;
              const timerId = setTimeout(() => {
                // Run async grammar check for the whole document
                // (Harper.js checks entire text at once, so we recheck everything)
                findGrammarIssues(
                  editor.state.doc,
                  storage.ignoredRules,
                  storage.ignoredIssues
                ).then((issues) => {
                  storage.issues = issues;
                  if (editor?.view) {
                    editor.view.dispatch(
                      editor.state.tr.setMeta(GrammarCheckPluginKey, {
                        type: "checkComplete",
                        pendingId: id,
                      })
                    );
                  }
                });
              }, WORD_DEBOUNCE_MS);

              pendingWords.set(id, { id, ...word, timerId });
              newlyAddedIds.add(id);
            }

            // 4. Map positions of PRE-EXISTING pending words only
            // (newly added words already have correct positions from newState.doc)
            for (const [id, pending] of pendingWords) {
              if (!newlyAddedIds.has(id)) {
                pending.from = tr.mapping.map(pending.from);
                pending.to = tr.mapping.map(pending.to);
              }
            }

            // 5. Update stored issues with mapped positions
            storage.issues = storage.issues.map((issue) => ({
              ...issue,
              from: tr.mapping.map(issue.from),
              to: tr.mapping.map(issue.to),
            }));

            // 6. Create decorations, excluding pending words
            return createDecorationsExcludingPending(
              newState.doc,
              storage.issues,
              grammarErrorClass,
              pendingWords
            );
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
