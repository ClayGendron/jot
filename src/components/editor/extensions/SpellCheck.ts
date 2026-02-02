/**
 * SpellCheck TipTap Extension
 *
 * Provides spell checking functionality with:
 * - Red wavy underline on misspelled words via ProseMirror decorations
 * - Code block exclusion (no spell checking inside code)
 * - Integration with SymSpell (via spellchecker-wasm) and personal dictionary
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import {
  checkWord,
  tokenizeText,
  initSpellChecker,
  isSpellCheckerReady,
  getSuggestions,
  addToPersonalDictionaryMemory,
  getSentenceContext,
} from "@/lib/spellcheck";
import type { SpellCheckLanguage, MisspelledWord } from "@/lib/spellcheck";
import { getChangedRanges, type Range } from "@/lib/proofing";

export interface SpellCheckOptions {
  /** CSS class for misspelled words */
  spellErrorClass: string;
  /** Language for spell checking */
  language: SpellCheckLanguage;
  /** Whether spell checking is enabled */
  enabled: boolean;
}

export interface SpellCheckStorage {
  /** Current language */
  language: SpellCheckLanguage;
  /** Whether spell checking is enabled */
  enabled: boolean;
  /** List of misspelled words with positions */
  errors: MisspelledWord[];
  /** Words to ignore for this session */
  ignoredWords: Set<string>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    spellCheck: {
      /**
       * Enable spell checking
       */
      enableSpellCheck: () => ReturnType;

      /**
       * Disable spell checking
       */
      disableSpellCheck: () => ReturnType;

      /**
       * Set spell check language
       */
      setSpellCheckLanguage: (language: SpellCheckLanguage) => ReturnType;

      /**
       * Add a word to the personal dictionary
       */
      addToPersonalDictionary: (word: string) => ReturnType;

      /**
       * Ignore a word for this session only
       */
      ignoreWord: (word: string) => ReturnType;

      /**
       * Replace a misspelled word with a suggestion
       */
      replaceWord: (from: number, to: number, replacement: string) => ReturnType;

      /**
       * Force a spell check refresh
       */
      refreshSpellCheck: () => ReturnType;
    };
  }
}

export const SpellCheckPluginKey = new PluginKey("spellCheck");

/** Delay before checking a word after typing stops */
const WORD_DEBOUNCE_MS = 500;

/** Counter for generating unique pending word IDs */
let nextSpellPendingId = 0;

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
 * Check if a word is likely a proper noun based on capitalization and position.
 * This is a simplified check that works within a single text node.
 *
 * Only applies to simple capitalized words (Paris, John, London).
 * Words with internal capitals (iPhone, MacBook, getUserName) are handled
 * by the identifier splitting logic in checkWord instead.
 */
function isLikelyProperNounInText(
  word: string,
  text: string,
  wordStart: number
): boolean {
  // Must be capitalized (first letter uppercase)
  if (!word || word[0] !== word[0].toUpperCase() || word[0] === word[0].toLowerCase()) {
    return false;
  }

  // Words with internal capitals should be handled by identifier splitting, not proper noun detection
  // e.g., iPhone → split to ["i", "Phone"], MacBook → split to ["Mac", "Book"]
  if (/[a-z][A-Z]/.test(word)) {
    return false;
  }

  // Get sentence context within this text node
  const context = getSentenceContext(text, wordStart, wordStart + word.length);

  // Words after title prefixes are proper nouns
  if (context.isAfterTitlePrefix) {
    return true;
  }

  // Words at sentence start are not assumed to be proper nouns
  if (context.isAtSentenceStart) {
    return false;
  }

  // Mid-sentence capitalized word = likely proper noun
  return true;
}

/**
 * Find all misspelled words in the document
 */
function findMisspelledWords(
  doc: ProseMirrorNode,
  ignoredWords: Set<string>
): MisspelledWord[] {
  const errors: MisspelledWord[] = [];

  if (!isSpellCheckerReady()) {
    return errors;
  }

  doc.descendants((node, pos) => {
    // Only check text nodes
    if (!node.isText || !node.text) {
      return;
    }

    // Skip if inside code block
    if (isInsideCode(doc, pos)) {
      return;
    }

    const text = node.text;
    const tokens = tokenizeText(text);

    for (const token of tokens) {
      const word = token.word;

      // Skip ignored words (case-insensitive)
      if (ignoredWords.has(word.toLowerCase())) {
        continue;
      }

      // Skip likely proper nouns (capitalized mid-sentence)
      if (isLikelyProperNounInText(word, text, token.start)) {
        continue;
      }

      // Check spelling (includes camelCase/snake_case splitting)
      if (!checkWord(word)) {
        errors.push({
          word,
          from: pos + token.start,
          to: pos + token.end,
        });
      }
    }
  });

  return errors;
}

/**
 * Create decorations for misspelled words
 */
function createDecorations(
  doc: ProseMirrorNode,
  errors: MisspelledWord[],
  errorClass: string
): DecorationSet {
  const decorations = errors.map((error) =>
    Decoration.inline(error.from, error.to, {
      class: errorClass,
      "data-spell-error": "true",
      "data-word": error.word,
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
  errors: MisspelledWord[],
  errorClass: string,
  pendingWords: Map<number, PendingWord>
): DecorationSet {
  const visibleErrors = errors.filter((error) => {
    for (const pending of pendingWords.values()) {
      // Check for overlap between error and pending word
      if (error.to >= pending.from && error.from <= pending.to) {
        return false; // Hide - user is typing this word
      }
    }
    return true;
  });
  return createDecorations(doc, visibleErrors, errorClass);
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

export const SpellCheck = Extension.create<SpellCheckOptions, SpellCheckStorage>({
  name: "spellCheck",

  addOptions() {
    return {
      spellErrorClass: "spell-error",
      language: "en_US",
      enabled: true,
    };
  },

  addStorage() {
    return {
      language: this.options.language,
      enabled: this.options.enabled,
      errors: [],
      ignoredWords: new Set(),
    };
  },

  onCreate() {
    // Initialize spell checker with configured language
    if (this.storage.enabled) {
      initSpellChecker(this.storage.language)
        .then(() => {
          // Force a transaction to trigger decoration refresh after dictionary loads
          this.editor.view.dispatch(this.editor.state.tr);
        })
        .catch(console.error);
    }
  },

  addCommands() {
    return {
      enableSpellCheck:
        () =>
        ({ editor, tr }) => {
          this.storage.enabled = true;

          // Initialize spell checker if not ready
          initSpellChecker(this.storage.language)
            .then(() => {
              // Refresh decorations
              editor.view.dispatch(tr);
            })
            .catch(console.error);

          return true;
        },

      disableSpellCheck:
        () =>
        ({ editor, tr }) => {
          this.storage.enabled = false;
          this.storage.errors = [];

          // Force view update to remove decorations
          editor.view.dispatch(tr);

          return true;
        },

      setSpellCheckLanguage:
        (language: SpellCheckLanguage) =>
        ({ editor, tr }) => {
          this.storage.language = language;

          // Load new dictionary
          initSpellChecker(language)
            .then(() => {
              // Refresh decorations with new language
              editor.view.dispatch(tr);
            })
            .catch(console.error);

          return true;
        },

      addToPersonalDictionary:
        (word: string) =>
        ({ editor, tr }) => {
          // Add to in-memory personal dictionary
          addToPersonalDictionaryMemory(word);

          // Remove from errors
          this.storage.errors = this.storage.errors.filter(
            (e) => e.word.toLowerCase() !== word.toLowerCase()
          );

          // Refresh decorations
          editor.view.dispatch(tr);

          return true;
        },

      ignoreWord:
        (word: string) =>
        ({ editor, tr }) => {
          // Add to session-only ignored words
          this.storage.ignoredWords.add(word.toLowerCase());

          // Remove from errors
          this.storage.errors = this.storage.errors.filter(
            (e) => e.word.toLowerCase() !== word.toLowerCase()
          );

          // Refresh decorations
          editor.view.dispatch(tr);

          return true;
        },

      replaceWord:
        (from: number, to: number, replacement: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            tr.insertText(replacement, from, to);
            dispatch(tr);
          }

          return true;
        },

      refreshSpellCheck:
        () =>
        ({ editor, tr }) => {
          // Force recalculation of spell errors
          this.storage.errors = findMisspelledWords(
            tr.doc,
            this.storage.ignoredWords
          );

          editor.view.dispatch(tr);

          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const { spellErrorClass } = this.options;
    const storage = this.storage;
    const editor = this.editor;

    // Track pending words (recently modified, not yet checked)
    // Use numeric IDs as keys for stability across position shifts
    const pendingWords = new Map<number, PendingWord>();

    return [
      new Plugin({
        key: SpellCheckPluginKey,

        state: {
          init(_, { doc }) {
            if (!storage.enabled) {
              return DecorationSet.empty;
            }

            // Initial spell check (may be empty if dictionary not loaded)
            storage.errors = findMisspelledWords(doc, storage.ignoredWords);
            // Use pending-aware decorations even on init
            return createDecorationsExcludingPending(
              doc,
              storage.errors,
              spellErrorClass,
              pendingWords
            );
          },

          apply(tr, oldDecorations, _oldState, newState) {
            // If spell check is disabled, return empty decorations
            if (!storage.enabled) {
              return DecorationSet.empty;
            }

            // If dictionary not ready, return empty decorations
            if (!isSpellCheckerReady()) {
              return DecorationSet.empty;
            }

            // Handle debounce completion signal
            const meta = tr.getMeta(SpellCheckPluginKey);
            if (meta?.type === "checkComplete") {
              const pendingId = meta.pendingId as number;
              pendingWords.delete(pendingId);
              // Recheck all words and update errors
              storage.errors = findMisspelledWords(
                newState.doc,
                storage.ignoredWords
              );
              return createDecorationsExcludingPending(
                newState.doc,
                storage.errors,
                spellErrorClass,
                pendingWords
              );
            }

            // Handle dictionary ready signal (from init or language change)
            const needsFullCheck =
              oldDecorations === DecorationSet.empty &&
              storage.errors.length === 0;

            if (!tr.docChanged) {
              if (needsFullCheck) {
                // Dictionary just became ready
                storage.errors = findMisspelledWords(
                  newState.doc,
                  storage.ignoredWords
                );
                return createDecorationsExcludingPending(
                  newState.doc,
                  storage.errors,
                  spellErrorClass,
                  pendingWords
                );
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
              const id = nextSpellPendingId++;
              const timerId = setTimeout(() => {
                if (editor?.view) {
                  editor.view.dispatch(
                    editor.state.tr.setMeta(SpellCheckPluginKey, {
                      type: "checkComplete",
                      pendingId: id,
                    })
                  );
                }
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

            // 5. Update stored errors with mapped positions
            storage.errors = storage.errors.map((e) => ({
              ...e,
              from: tr.mapping.map(e.from),
              to: tr.mapping.map(e.to),
            }));

            // 6. Create decorations, excluding pending words
            return createDecorationsExcludingPending(
              newState.doc,
              storage.errors,
              spellErrorClass,
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
 * Get suggestions for a misspelled word at a position
 */
export function getSpellSuggestions(word: string): string[] {
  return getSuggestions(word);
}

export default SpellCheck;
