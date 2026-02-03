/**
 * Auto-Close Markdown Extension for CodeMirror 6
 *
 * Phase 2: IDE-like behavior for markdown markers.
 * - Typing * inserts paired *|*
 * - Typing * again between *|* upgrades to **|**
 * - Exception: line start allows list markers (- * +)
 *
 * Similar to how IDEs auto-close brackets, this auto-closes
 * markdown emphasis markers for a smoother editing experience.
 */

import { EditorView, keymap } from "@codemirror/view";
import { EditorSelection, type Extension } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

/**
 * Check if cursor is at the start of a line (allowing for whitespace)
 * List markers (* - +) should only work at line start
 */
function isAtLineStart(view: EditorView, pos: number): boolean {
  const line = view.state.doc.lineAt(pos);
  const textBeforeCursor = view.state.doc.sliceString(line.from, pos);

  // Check if only whitespace before cursor
  return /^\s*$/.test(textBeforeCursor);
}

/**
 * Check if cursor is inside a code block or inline code
 */
function isInsideCode(view: EditorView, pos: number): boolean {
  const tree = syntaxTree(view.state);
  let node = tree.resolveInner(pos, -1);

  const codeNodes = new Set([
    "CodeBlock",
    "FencedCode",
    "InlineCode",
    "CodeText",
    "CodeMark",
  ]);

  while (node) {
    if (codeNodes.has(node.name)) {
      return true;
    }
    node = node.parent!;
  }

  return false;
}

/**
 * Check if cursor is between matching markers (e.g., *|* or _|_)
 */
function isBetweenMarkers(view: EditorView, pos: number, marker: string): boolean {
  const doc = view.state.doc;
  const before = doc.sliceString(Math.max(0, pos - 1), pos);
  const after = doc.sliceString(pos, Math.min(doc.length, pos + 1));

  return before === marker && after === marker;
}

/**
 * Handle asterisk (*) key press
 *
 * @returns true if the key was handled, false to let default behavior proceed
 */
export function handleAsterisk(view: EditorView): boolean {
  const { state } = view;
  const selection = state.selection.main;

  // If there's a selection, wrap it with asterisks
  if (!selection.empty) {
    const text = state.doc.sliceString(selection.from, selection.to);
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: `*${text}*` },
      selection: EditorSelection.range(selection.from + 1, selection.to + 1),
    });
    return true;
  }

  const pos = selection.head;

  // Don't auto-close at line start (allow list markers)
  if (isAtLineStart(view, pos)) {
    return false;
  }

  // Don't auto-close inside code
  if (isInsideCode(view, pos)) {
    return false;
  }

  // Check if we're between *|* and should upgrade to **|**
  if (isBetweenMarkers(view, pos, "*")) {
    // Insert another * on each side
    view.dispatch({
      changes: [
        { from: pos - 1, to: pos - 1, insert: "*" },
        { from: pos + 1, to: pos + 1, insert: "*" },
      ],
      selection: EditorSelection.cursor(pos + 1),
    });
    return true;
  }

  // Insert paired *|*
  view.dispatch({
    changes: { from: pos, insert: "**" },
    selection: EditorSelection.cursor(pos + 1),
  });
  return true;
}

/**
 * Handle underscore (_) key press
 *
 * @returns true if the key was handled, false to let default behavior proceed
 */
export function handleUnderscore(view: EditorView): boolean {
  const { state } = view;
  const selection = state.selection.main;

  // If there's a selection, wrap it with underscores
  if (!selection.empty) {
    const text = state.doc.sliceString(selection.from, selection.to);
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: `_${text}_` },
      selection: EditorSelection.range(selection.from + 1, selection.to + 1),
    });
    return true;
  }

  const pos = selection.head;

  // Don't auto-close inside code
  if (isInsideCode(view, pos)) {
    return false;
  }

  // Check if we're between _|_ and should upgrade to __|__
  if (isBetweenMarkers(view, pos, "_")) {
    view.dispatch({
      changes: [
        { from: pos - 1, to: pos - 1, insert: "_" },
        { from: pos + 1, to: pos + 1, insert: "_" },
      ],
      selection: EditorSelection.cursor(pos + 1),
    });
    return true;
  }

  // Insert paired _|_
  view.dispatch({
    changes: { from: pos, insert: "__" },
    selection: EditorSelection.cursor(pos + 1),
  });
  return true;
}

/**
 * Handle tilde (~) key press for strikethrough
 *
 * @returns true if the key was handled, false to let default behavior proceed
 */
export function handleTilde(view: EditorView): boolean {
  const { state } = view;
  const selection = state.selection.main;

  // If there's a selection, wrap it with tildes
  if (!selection.empty) {
    const text = state.doc.sliceString(selection.from, selection.to);
    view.dispatch({
      changes: { from: selection.from, to: selection.to, insert: `~${text}~` },
      selection: EditorSelection.range(selection.from + 1, selection.to + 1),
    });
    return true;
  }

  const pos = selection.head;

  // Don't auto-close inside code
  if (isInsideCode(view, pos)) {
    return false;
  }

  // Check if we're between ~|~ and should upgrade to ~~|~~
  if (isBetweenMarkers(view, pos, "~")) {
    view.dispatch({
      changes: [
        { from: pos - 1, to: pos - 1, insert: "~" },
        { from: pos + 1, to: pos + 1, insert: "~" },
      ],
      selection: EditorSelection.cursor(pos + 1),
    });
    return true;
  }

  // Insert paired ~|~
  view.dispatch({
    changes: { from: pos, insert: "~~" },
    selection: EditorSelection.cursor(pos + 1),
  });
  return true;
}

/**
 * Auto-close markdown extension
 *
 * Provides IDE-like auto-closing for markdown emphasis markers:
 * - * auto-closes to *|*
 * - _ auto-closes to _|_
 * - ~ auto-closes to ~|~
 *
 * Exceptions:
 * - Line start: allows list markers (* - +)
 * - Inside code: no auto-closing
 */
export const autoCloseMarkdown: Extension = keymap.of([
  {
    key: "*",
    run: handleAsterisk,
  },
  {
    key: "_",
    run: handleUnderscore,
  },
  {
    key: "~",
    run: handleTilde,
  },
]);
