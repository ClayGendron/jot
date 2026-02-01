/**
 * SpellCheck TipTap Extension
 *
 * Provides spell checking functionality with:
 * - Red wavy underline on misspelled words via ProseMirror decorations
 * - Code block exclusion (no spell checking inside code)
 * - Integration with Typo.js and personal dictionary
 * - Debounced checking for performance
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
} from "@/lib/spellcheck";
import type { SpellCheckLanguage, MisspelledWord } from "@/lib/spellcheck";

export interface SpellCheckOptions {
  /** CSS class for misspelled words */
  spellErrorClass: string;
  /** Debounce delay in milliseconds */
  debounceMs: number;
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
  /** Debounce timer ID */
  debounceTimer: ReturnType<typeof setTimeout> | null;
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

      // Check spelling
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

export const SpellCheck = Extension.create<SpellCheckOptions, SpellCheckStorage>({
  name: "spellCheck",

  addOptions() {
    return {
      spellErrorClass: "spell-error",
      debounceMs: 500,
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
      debounceTimer: null,
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
            return createDecorations(doc, storage.errors, spellErrorClass);
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

            // Check if we need to recompute decorations:
            // 1. Document changed
            // 2. Dictionary just became ready (old decorations empty but checker ready)
            const needsRecheck = tr.docChanged ||
              (oldDecorations === DecorationSet.empty && storage.errors.length === 0);

            if (needsRecheck) {
              // Check all words and create decorations
              storage.errors = findMisspelledWords(
                newState.doc,
                storage.ignoredWords
              );
              return createDecorations(
                newState.doc,
                storage.errors,
                spellErrorClass
              );
            }

            // No document change - keep existing decorations
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
 * Get suggestions for a misspelled word at a position
 */
export function getSpellSuggestions(word: string): string[] {
  return getSuggestions(word);
}

export default SpellCheck;
