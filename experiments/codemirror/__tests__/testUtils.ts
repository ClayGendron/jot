/**
 * Test utilities for CodeMirror integration tests
 *
 * Provides helper functions to create an EditorView with full WYSIWYG extensions
 * loaded, and utilities to verify document state with cursor position.
 */

import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { syntaxHighlighting } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { GFM } from "@lezer/markdown";
import { history, historyKeymap, defaultKeymap } from "@codemirror/commands";

import {
  codeBlockRectangularSelection,
  formattingEscapeKeymap,
  formattingInputHandler,
  hiddenRangesField,
  hiddenSyntaxField,
  selectionSnapper,
  pendingFormattingField,
  pendingFormatTheme,
  styleField,
  theme,
  codeHighlightStyle,
  HighlightExtension,
} from "../harness";

export interface TestView {
  view: EditorView;
  destroy: () => void;
}

export interface CreateTestViewOptions {
  /** Whether to enable hidden syntax decorations (default: true) */
  hidesSyntax?: boolean;
  /** Selection anchor position (overrides cursor from docWithCursor) */
  anchor?: number;
  /** Selection head position for range selections */
  head?: number;
}

/**
 * Create an EditorView with full WYSIWYG extensions loaded
 *
 * @param docWithCursor - Document content with | marking cursor position.
 *   If no | is present, cursor defaults to end of document.
 *   For range selections, use |[ and ]| markers or provide anchor/head options.
 * @param options - Configuration options
 * @returns TestView with view and destroy function
 *
 * @example
 * ```ts
 * const { view, destroy } = createTestView("> Hello|");
 * // view has cursor at position 7 (after "Hello")
 * destroy(); // cleanup
 * ```
 */
export function createTestView(
  docWithCursor: string,
  options: CreateTestViewOptions = {}
): TestView {
  const { hidesSyntax = true } = options;

  // Parse cursor position from | marker
  let cursorPos = docWithCursor.indexOf("|");
  let doc = docWithCursor;

  if (cursorPos >= 0) {
    doc = docWithCursor.slice(0, cursorPos) + docWithCursor.slice(cursorPos + 1);
  } else {
    cursorPos = doc.length;
  }

  // Use provided anchor/head if available
  const anchor = options.anchor ?? cursorPos;
  const head = options.head ?? anchor;

  // Create container in document body (required for some CodeMirror features)
  const container = document.createElement("div");
  document.body.appendChild(container);

  const extensions = [
    formattingInputHandler,
    codeBlockRectangularSelection,
    markdown({ extensions: [GFM, HighlightExtension], codeLanguages: languages }),
    syntaxHighlighting(codeHighlightStyle),
    history(),
    Prec.highest(formattingEscapeKeymap),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    theme,
    styleField,
  ];

  if (hidesSyntax) {
    extensions.push(hiddenRangesField);
    extensions.push(hiddenSyntaxField);
    extensions.push(selectionSnapper);
    extensions.push(pendingFormattingField);
    extensions.push(pendingFormatTheme);
  }

  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor, head },
      extensions,
    }),
    parent: container,
  });

  return {
    view,
    destroy: () => {
      view.destroy();
      container.remove();
    },
  };
}

/**
 * Get document string with cursor position marked by |
 *
 * @param view - EditorView instance
 * @returns Document content with | at cursor position
 *
 * @example
 * ```ts
 * expect(getDocWithCursor(view)).toBe("> Hello\n> |");
 * ```
 */
export function getDocWithCursor(view: EditorView): string {
  const doc = view.state.doc.toString();
  const cursor = view.state.selection.main.head;
  return doc.slice(0, cursor) + "|" + doc.slice(cursor);
}

/**
 * Type text at current cursor position
 *
 * @param view - EditorView instance
 * @param text - Text to insert
 */
export function typeText(view: EditorView, text: string): void {
  const pos = view.state.selection.main.head;
  view.dispatch({
    changes: { from: pos, to: pos, insert: text },
    selection: { anchor: pos + text.length },
  });
}

/**
 * Set selection to a range
 *
 * @param view - EditorView instance
 * @param anchor - Start of selection
 * @param head - End of selection
 */
export function setSelection(view: EditorView, anchor: number, head: number): void {
  view.dispatch({
    selection: { anchor, head },
  });
}

/**
 * Create a minimal EditorView with only markdown parsing (no WYSIWYG extensions).
 * Use for testing handler functions that don't need hidden syntax decorations.
 *
 * @param docWithCursor - Document content with | marking cursor position.
 * @returns TestView with view and destroy function
 */
export function createMinimalView(docWithCursor: string): TestView {
  const cursorIdx = docWithCursor.indexOf("|");
  const doc = cursorIdx >= 0
    ? docWithCursor.slice(0, cursorIdx) + docWithCursor.slice(cursorIdx + 1)
    : docWithCursor;
  const pos = cursorIdx >= 0 ? cursorIdx : doc.length;

  const view = new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: pos },
      extensions: [markdown({ extensions: [GFM, HighlightExtension] })],
    }),
  });

  return {
    view,
    destroy: () => view.destroy(),
  };
}

