/**
 * CodeMirror 6 Spell Check Extension
 *
 * Provides spell checking with:
 * - Red wavy underline on misspelled words via decorations
 * - Code block exclusion (no spell checking inside code)
 * - Integration with SymSpell via lib/spellcheck
 * - Personal dictionary and session ignore support
 */

import { StateField, StateEffect, type Extension } from "@codemirror/state";
import { EditorView, Decoration, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

import {
  checkWord,
  tokenizeText,
  isSpellCheckerReady,
  getSentenceContext,
} from "@/lib/spellcheck";

/**
 * A misspelled word with position
 */
export interface SpellError {
  word: string;
  from: number;
  to: number;
}

/**
 * Internal spell check state
 */
interface SpellCheckState {
  errors: SpellError[];
  ignoredWords: Set<string>;
  decorations: DecorationSet;
}

// Effects for updating spell check state
const setErrors = StateEffect.define<SpellError[]>();
const addIgnored = StateEffect.define<string>();
const clearIgnoredEffect = StateEffect.define<void>();
const forceRefresh = StateEffect.define<void>();

/**
 * Decoration for misspelled words
 */
const spellErrorMark = Decoration.mark({
  class: "spell-error",
  attributes: { "data-spell-error": "true" },
});

/**
 * Check if a position is inside a code block or inline code
 */
function isInsideCode(state: { doc: { toString(): string }; }, from: number, to: number): boolean {
  let insideCode = false;

  try {
    const tree = syntaxTree(state as any);

    // Check if any ancestor is a code-related node
    tree.iterate({
      from,
      to,
      enter(node) {
        const name = node.name.toLowerCase();
        if (
          name.includes("code") ||
          name.includes("fencedcode") ||
          name.includes("inlinecode") ||
          name === "codemark" ||
          name === "codetext" ||
          name === "codeinfo"
        ) {
          insideCode = true;
          return false; // Stop iteration
        }
      },
    });
  } catch {
    // If syntax tree not available, fall back to simple check
    return false;
  }

  return insideCode;
}

/**
 * Check if a word is likely a proper noun based on capitalization
 */
function isLikelyProperNoun(
  word: string,
  text: string,
  wordStart: number
): boolean {
  // Must be capitalized
  if (!word || word[0] !== word[0].toUpperCase() || word[0] === word[0].toLowerCase()) {
    return false;
  }

  // Words with internal capitals handled by identifier splitting
  if (/[a-z][A-Z]/.test(word)) {
    return false;
  }

  const context = getSentenceContext(text, wordStart, wordStart + word.length);

  if (context.isAfterTitlePrefix) {
    return true;
  }

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
  state: { doc: { toString(): string } },
  ignoredWords: Set<string>
): SpellError[] {
  if (!isSpellCheckerReady()) {
    return [];
  }

  const errors: SpellError[] = [];
  const text = state.doc.toString();
  const tokens = tokenizeText(text);

  for (const token of tokens) {
    const word = token.word;

    // Skip ignored words (case-insensitive)
    if (ignoredWords.has(word.toLowerCase())) {
      continue;
    }

    // Skip if inside code
    if (isInsideCode(state, token.start, token.end)) {
      continue;
    }

    // Skip likely proper nouns
    if (isLikelyProperNoun(word, text, token.start)) {
      continue;
    }

    // Check spelling
    if (!checkWord(word)) {
      errors.push({
        word,
        from: token.start,
        to: token.end,
      });
    }
  }

  return errors;
}

/**
 * Create decorations from spell errors
 */
function createDecorations(errors: SpellError[]): DecorationSet {
  const decorations = errors.map((error) =>
    spellErrorMark.range(error.from, error.to)
  );

  return Decoration.set(decorations, true);
}

/**
 * Spell check state field
 */
const spellCheckField = StateField.define<SpellCheckState>({
  create(state) {
    const errors = findMisspelledWords(state, new Set());
    return {
      errors,
      ignoredWords: new Set(),
      decorations: createDecorations(errors),
    };
  },

  update(value, tr) {
    let { errors, ignoredWords, decorations } = value;
    let needsRefresh = false;

    // Process effects
    for (const effect of tr.effects) {
      if (effect.is(setErrors)) {
        errors = effect.value;
        decorations = createDecorations(errors);
      } else if (effect.is(addIgnored)) {
        ignoredWords = new Set(ignoredWords);
        ignoredWords.add(effect.value.toLowerCase());
        needsRefresh = true;
      } else if (effect.is(clearIgnoredEffect)) {
        ignoredWords = new Set();
        needsRefresh = true;
      } else if (effect.is(forceRefresh)) {
        needsRefresh = true;
      }
    }

    // Recalculate on document change or refresh request
    if (tr.docChanged || needsRefresh) {
      errors = findMisspelledWords(tr.state, ignoredWords);
      decorations = createDecorations(errors);
    }

    return { errors, ignoredWords, decorations };
  },

  provide(field) {
    return EditorView.decorations.from(field, (value) => value.decorations);
  },
});

/**
 * Create the spell check extension
 */
export function createSpellCheckExtension(): Extension {
  return [spellCheckField];
}

/**
 * Get current spell errors
 */
export function getSpellErrors(view: EditorView): SpellError[] {
  return view.state.field(spellCheckField).errors;
}

/**
 * Add a word to the session ignore list
 */
export function addToIgnored(view: EditorView, word: string): void {
  view.dispatch({
    effects: addIgnored.of(word),
  });
}

/**
 * Clear all ignored words
 */
export function clearIgnored(view: EditorView): void {
  view.dispatch({
    effects: clearIgnoredEffect.of(undefined),
  });
}

/**
 * Replace a word in the document
 */
export function replaceWord(
  view: EditorView,
  from: number,
  to: number,
  replacement: string
): void {
  view.dispatch({
    changes: { from, to, insert: replacement },
  });
}

/**
 * Force a spell check refresh
 */
export function refreshSpellCheck(view: EditorView): void {
  view.dispatch({
    effects: forceRefresh.of(undefined),
  });
}

/**
 * Get spell error at a specific position
 */
export function getSpellErrorAt(
  view: EditorView,
  pos: number
): SpellError | null {
  const errors = getSpellErrors(view);
  return errors.find((e) => pos >= e.from && pos <= e.to) ?? null;
}
