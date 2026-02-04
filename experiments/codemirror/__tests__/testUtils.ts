/**
 * Test utilities for CodeMirror integration tests
 *
 * Provides helper functions to create an EditorView with full WYSIWYG extensions
 * loaded, and utilities to verify document state with cursor position.
 */

import { EditorState, Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { history, historyKeymap, defaultKeymap } from "@codemirror/commands";

import {
  formattingEscapeKeymap,
  formattingInputHandler,
  hiddenSyntaxField,
  pendingFormattingField,
  pendingFormatTheme,
  cursorGuard,
  styleField,
  theme,
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
    markdown({ extensions: [GFM] }),
    history(),
    Prec.highest(formattingEscapeKeymap),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    theme,
    styleField,
  ];

  if (hidesSyntax) {
    extensions.push(hiddenSyntaxField);
    extensions.push(pendingFormattingField);
    extensions.push(pendingFormatTheme);
    extensions.push(cursorGuard);
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
 * Get document string with selection marked by [| and |]
 *
 * @param view - EditorView instance
 * @returns Document content with [| at anchor and |] at head (or | if collapsed)
 */
export function getDocWithSelection(view: EditorView): string {
  const doc = view.state.doc.toString();
  const { anchor, head } = view.state.selection.main;

  if (anchor === head) {
    return doc.slice(0, head) + "|" + doc.slice(head);
  }

  const [start, end] = anchor < head ? [anchor, head] : [head, anchor];
  return (
    doc.slice(0, start) +
    "[|" +
    doc.slice(start, end) +
    "|]" +
    doc.slice(end)
  );
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
 * Set cursor to a specific position
 *
 * @param view - EditorView instance
 * @param pos - Position to set cursor to
 */
export function setCursor(view: EditorView, pos: number): void {
  view.dispatch({
    selection: { anchor: pos },
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
 * Get the current cursor position
 *
 * @param view - EditorView instance
 * @returns Current cursor position (selection head)
 */
export function getCursorPos(view: EditorView): number {
  return view.state.selection.main.head;
}

/**
 * Get the document text
 *
 * @param view - EditorView instance
 * @returns Document content as string
 */
export function getDoc(view: EditorView): string {
  return view.state.doc.toString();
}

/**
 * Check if the selection is empty (cursor with no range)
 *
 * @param view - EditorView instance
 * @returns True if selection is empty
 */
export function isSelectionEmpty(view: EditorView): boolean {
  return view.state.selection.main.empty;
}
