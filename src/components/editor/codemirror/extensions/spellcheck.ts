/**
 * Spellcheck Extension for CodeMirror
 *
 * Integrates the SymSpell-based spellchecker with CodeMirror.
 * Highlights misspelled words with wavy underlines.
 */

import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { StateField, StateEffect, RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import {
  checkWord,
  isSpellCheckerReady,
  getSuggestions,
  addToPersonalDictionary,
  dictionaryHierarchy,
} from "@/lib/spellcheck";

// ===========================================
// TYPES
// ===========================================

export interface SpellcheckConfig {
  /** Whether spellcheck is enabled */
  enabled: boolean;
  /** Delay in ms before checking after typing stops */
  debounceMs?: number;
}

interface MisspelledWord {
  word: string;
  from: number;
  to: number;
}

// ===========================================
// STATE EFFECTS
// ===========================================

/** Effect to update misspelled words */
const setMisspelledWords = StateEffect.define<MisspelledWord[]>();

/** Effect to enable/disable spellcheck */
const setSpellcheckEnabled = StateEffect.define<boolean>();

// ===========================================
// DECORATION
// ===========================================

const misspelledMark = Decoration.mark({
  class: "cm-misspelled",
  attributes: { "data-misspelled": "true" },
});

// ===========================================
// STATE FIELD
// ===========================================

/**
 * StateField that holds the decorations for misspelled words.
 */
export const spellcheckField = StateField.define<{
  decorations: DecorationSet;
  enabled: boolean;
}>({
  create() {
    return {
      decorations: Decoration.none,
      enabled: true,
    };
  },
  update(value, tr) {
    let { decorations, enabled } = value;

    // Handle enable/disable effect
    for (const effect of tr.effects) {
      if (effect.is(setSpellcheckEnabled)) {
        enabled = effect.value;
        if (!enabled) {
          decorations = Decoration.none;
        }
      }
      if (effect.is(setMisspelledWords) && enabled) {
        const builder = new RangeSetBuilder<Decoration>();
        const words = effect.value.sort((a, b) => a.from - b.from);
        for (const { from, to } of words) {
          if (from < to && from >= 0 && to <= tr.state.doc.length) {
            builder.add(from, to, misspelledMark);
          }
        }
        decorations = builder.finish();
      }
    }

    // Map decorations through document changes
    if (tr.docChanged && decorations !== Decoration.none) {
      decorations = decorations.map(tr.changes);
    }

    return { decorations, enabled };
  },
  provide: (field) =>
    EditorView.decorations.from(field, (value) => value.decorations),
});

// ===========================================
// HELPERS
// ===========================================

/**
 * Node types that should be excluded from spell checking.
 */
const EXCLUDED_NODE_TYPES = new Set([
  "CodeBlock",
  "FencedCode",
  "InlineCode",
  "CodeText",
  "URL",
  "Link",
  "Image",
  "HTMLTag",
  "HTMLBlock",
  "Comment",
  "CodeInfo",
  "LinkLabel",
  "LinkReference",
]);

/**
 * Check if a position is inside an excluded node type.
 */
function isExcludedPosition(view: EditorView, pos: number): boolean {
  const tree = syntaxTree(view.state);
  let node = tree.resolveInner(pos, 1);

  while (node) {
    if (EXCLUDED_NODE_TYPES.has(node.name)) {
      return true;
    }
    // Check parent nodes too
    if (node.parent) {
      node = node.parent;
    } else {
      break;
    }
  }

  return false;
}

/**
 * Tokenize text into words with their positions.
 */
function tokenizeWords(
  text: string,
  offset: number
): Array<{ word: string; from: number; to: number }> {
  const words: Array<{ word: string; from: number; to: number }> = [];
  // Match word characters, including contractions (don't, it's, etc.)
  const wordRegex = /[a-zA-Z]+(?:'[a-zA-Z]+)?/g;
  let match;

  while ((match = wordRegex.exec(text)) !== null) {
    const word = match[0];
    // Skip very short words and all-caps (likely acronyms)
    if (word.length >= 2 && !/^[A-Z]+$/.test(word)) {
      words.push({
        word,
        from: offset + match.index,
        to: offset + match.index + word.length,
      });
    }
  }

  return words;
}

/**
 * Check spelling for a range of the document.
 */
function checkSpellingInRange(
  view: EditorView,
  from: number,
  to: number
): MisspelledWord[] {
  if (!isSpellCheckerReady()) {
    return [];
  }

  const misspelled: MisspelledWord[] = [];
  const text = view.state.doc.sliceString(from, to);
  const words = tokenizeWords(text, from);

  for (const { word, from: wordFrom, to: wordTo } of words) {
    // Skip if in excluded context (code, links, etc.)
    if (isExcludedPosition(view, wordFrom)) {
      continue;
    }

    // Skip words in personal dictionary (sync check via dictionaryHierarchy)
    if (dictionaryHierarchy.isInPersonalDictionary(word)) {
      continue;
    }

    // Check spelling
    if (!checkWord(word)) {
      misspelled.push({ word, from: wordFrom, to: wordTo });
    }
  }

  return misspelled;
}

/**
 * Check spelling for the entire document.
 */
function checkEntireDocument(view: EditorView): MisspelledWord[] {
  return checkSpellingInRange(view, 0, view.state.doc.length);
}

// ===========================================
// VIEW PLUGIN
// ===========================================

/**
 * ViewPlugin that manages spell checking.
 * Debounces checks and only checks visible/changed areas.
 */
function createSpellcheckPlugin(config: SpellcheckConfig) {
  return ViewPlugin.fromClass(
    class {
      private debounceTimer: ReturnType<typeof setTimeout> | null = null;
      private pendingCheck = false;

      constructor(private view: EditorView) {
        // Initial check after a short delay to let the spellchecker initialize
        this.scheduleCheck(500);
      }

      update(update: ViewUpdate) {
        // Check if spellcheck was just enabled
        const field = update.state.field(spellcheckField);
        const oldField = update.startState.field(spellcheckField);

        if (field.enabled && !oldField.enabled) {
          // Just enabled - do a full check
          this.scheduleCheck(100);
          return;
        }

        if (!field.enabled) {
          return;
        }

        // Check on document changes
        if (update.docChanged) {
          this.scheduleCheck(config.debounceMs ?? 300);
        }
      }

      private scheduleCheck(delay: number) {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
        this.pendingCheck = true;
        this.debounceTimer = setTimeout(() => {
          this.runCheck();
        }, delay);
      }

      private runCheck() {
        if (!this.pendingCheck) return;
        this.pendingCheck = false;

        const field = this.view.state.field(spellcheckField);
        if (!field.enabled) return;

        const misspelled = checkEntireDocument(this.view);
        this.view.dispatch({
          effects: setMisspelledWords.of(misspelled),
        });
      }

      destroy() {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
      }
    }
  );
}

// ===========================================
// CONTEXT MENU STATE
// ===========================================

interface SpellcheckContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  word: string;
  from: number;
  to: number;
  suggestions: string[];
}

let contextMenuState: SpellcheckContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  word: "",
  from: 0,
  to: 0,
  suggestions: [],
};

let contextMenuListeners: Array<
  (state: SpellcheckContextMenuState) => void
> = [];

export function subscribeSpellcheckContextMenu(
  listener: (state: SpellcheckContextMenuState) => void
): () => void {
  contextMenuListeners.push(listener);
  return () => {
    contextMenuListeners = contextMenuListeners.filter((l) => l !== listener);
  };
}

function notifyContextMenuListeners() {
  for (const listener of contextMenuListeners) {
    listener(contextMenuState);
  }
}

export function openSpellcheckContextMenu(
  x: number,
  y: number,
  word: string,
  from: number,
  to: number
) {
  const suggestions = getSuggestions(word);
  contextMenuState = { visible: true, x, y, word, from, to, suggestions };
  notifyContextMenuListeners();
}

export function closeSpellcheckContextMenu() {
  if (contextMenuState.visible) {
    contextMenuState = { ...contextMenuState, visible: false };
    notifyContextMenuListeners();
  }
}

export function getSpellcheckContextMenuState(): SpellcheckContextMenuState {
  return contextMenuState;
}

// ===========================================
// CONTEXT MENU HANDLERS
// ===========================================

export function handleSpellcheckSuggestion(view: EditorView, suggestion: string) {
  const { from, to } = contextMenuState;
  view.dispatch({
    changes: { from, to, insert: suggestion },
  });
  closeSpellcheckContextMenu();
}

export function handleAddToPersonalDictionary(view: EditorView) {
  const { word } = contextMenuState;
  // Fire and forget - the async operation will complete in the background
  addToPersonalDictionary(word);
  // Also add to in-memory hierarchy for immediate effect
  dictionaryHierarchy.addToPersonalDictionary(word);
  // Re-run spellcheck to remove the decoration
  const misspelled = checkEntireDocument(view);
  view.dispatch({
    effects: setMisspelledWords.of(misspelled),
  });
  closeSpellcheckContextMenu();
}

export function handleIgnoreWord() {
  // For now, just close the menu. In the future, could add to session ignore list.
  closeSpellcheckContextMenu();
}

// ===========================================
// EVENT HANDLERS
// ===========================================

/**
 * Context menu handler for misspelled words.
 */
const spellcheckContextMenuHandler = EditorView.domEventHandlers({
  contextmenu(event, view) {
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;

    // Check if clicking on a misspelled word
    const field = view.state.field(spellcheckField);
    let word = "";
    let from = 0;
    let to = 0;
    let found = false;

    field.decorations.between(pos, pos, (rangeFrom, rangeTo) => {
      word = view.state.doc.sliceString(rangeFrom, rangeTo);
      from = rangeFrom;
      to = rangeTo;
      found = true;
      return false; // Stop iteration
    });

    if (found) {
      event.preventDefault();
      openSpellcheckContextMenu(event.clientX, event.clientY, word, from, to);
      return true;
    }

    return false;
  },
});

// ===========================================
// PUBLIC API
// ===========================================

/**
 * Enable or disable spellcheck at runtime.
 */
export function setSpellcheckEnabledCmd(view: EditorView, enabled: boolean) {
  view.dispatch({
    effects: setSpellcheckEnabled.of(enabled),
  });
}

/**
 * Force a spellcheck refresh.
 */
export function refreshSpellcheck(view: EditorView) {
  const field = view.state.field(spellcheckField);
  if (!field.enabled) return;

  const misspelled = checkEntireDocument(view);
  view.dispatch({
    effects: setMisspelledWords.of(misspelled),
  });
}

/**
 * Create the spellcheck extension bundle.
 */
export function createSpellcheckExtension(
  config: SpellcheckConfig = { enabled: true }
) {
  return [
    spellcheckField,
    createSpellcheckPlugin(config),
    spellcheckContextMenuHandler,
    spellcheckTheme,
  ];
}

// ===========================================
// THEME
// ===========================================

const spellcheckTheme = EditorView.baseTheme({
  ".cm-misspelled": {
    textDecoration: "underline wavy var(--color-destructive, #ef4444)",
    textUnderlineOffset: "3px",
  },
});
