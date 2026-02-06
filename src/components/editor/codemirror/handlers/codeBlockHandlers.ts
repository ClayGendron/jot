/**
 * Code Block Handlers
 *
 * Keyboard handlers for fenced code blocks:
 * - Backspace/Delete at boundaries
 * - Tab/Shift-Tab indentation
 * - Code block detection utilities
 */

import type { EditorView } from "@codemirror/view";
import { getCodeBlockAtLine } from "./tableHandlers";

// ===========================================
// CONSTANTS
// ===========================================

const CODE_FENCE_REGEX = /^(`{3,})(\w*)\s*$/;

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Check if a line is the start of a fenced code block
 */
export function isCodeFenceStart(lineText: string): { fence: string; language: string } | null {
  const match = lineText.match(CODE_FENCE_REGEX);
  if (match) {
    return { fence: match[1], language: match[2] || "" };
  }
  return null;
}

/**
 * Check if cursor is inside a fenced code block.
 * When true, all special key handlers should be bypassed for plain text editing.
 */
export function isCursorInCodeBlock(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  return getCodeBlockAtLine(view.state, line.number) !== null;
}

/**
 * Wrap a keymap handler to bypass it when cursor is inside a code block.
 * Returns false (letting default behavior handle the key) when inside a code block.
 */
export function bypassInCodeBlock(handler: (view: EditorView) => boolean): (view: EditorView) => boolean {
  return (view) => isCursorInCodeBlock(view) ? false : handler(view);
}

// ===========================================
// BACKSPACE/DELETE HANDLERS
// ===========================================

/**
 * Handle Backspace when cursor is at start of line after a code block
 * Delete the entire code block
 */
export function handleBackspaceAfterCodeBlock(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must have no selection
  if (!state.selection.main.empty) return false;

  // Must be at start of line
  if (pos !== line.from) return false;

  // Must not be first line
  if (line.number <= 1) return false;

  // Check if previous line is the end of a code block
  const prevLine = state.doc.line(line.number - 1);
  if (prevLine.text.match(/^`{3,}$/)) {
    // Find the opening fence
    for (let i = line.number - 2; i >= 1; i--) {
      const checkLine = state.doc.line(i);
      if (isCodeFenceStart(checkLine.text)) {
        // Verify this is the matching opener
        const codeBlock = getCodeBlockAtLine(state, i);
        if (codeBlock && state.doc.lineAt(codeBlock.to).number === line.number - 1) {
          // Delete the entire code block
          view.dispatch({
            changes: { from: codeBlock.from, to: line.from, insert: "" },
            selection: { anchor: codeBlock.from },
            scrollIntoView: true,
          });
          return true;
        }
        break;
      }
    }
  }

  return false;
}

/**
 * Handle Delete when cursor is at end of line before a code block
 * Delete the entire code block
 */
export function handleDeleteBeforeCodeBlock(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must have no selection
  if (!state.selection.main.empty) return false;

  // Must be at end of line
  if (pos !== line.to) return false;

  // Must not be last line
  if (line.number >= state.doc.lines) return false;

  // Check if next line starts a code block
  const nextLine = state.doc.line(line.number + 1);
  if (isCodeFenceStart(nextLine.text)) {
    const codeBlock = getCodeBlockAtLine(state, line.number + 1);
    if (codeBlock) {
      // Delete the newline and the entire code block
      view.dispatch({
        changes: { from: line.to, to: codeBlock.to, insert: "" },
        scrollIntoView: true,
      });
      return true;
    }
  }

  return false;
}

// ===========================================
// TAB HANDLERS
// ===========================================

/**
 * Handle Tab inside a code block by inserting a tab character.
 * For selections, indent each selected line with a tab.
 */
export function handleTabInCodeBlock(view: EditorView): boolean {
  if (!isCursorInCodeBlock(view)) return false;

  const state = view.state;
  const sel = state.selection.main;

  // Collapsed selection: insert a tab at the cursor
  if (sel.empty) {
    const pos = sel.head;
    view.dispatch({
      changes: { from: pos, to: pos, insert: "\t" },
      selection: { anchor: pos + 1 },
      scrollIntoView: true,
    });
    return true;
  }

  const from = Math.min(sel.anchor, sel.head);
  const to = Math.max(sel.anchor, sel.head);
  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(to);
  const lineStarts: number[] = [];

  for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
    const line = state.doc.line(lineNum);
    // If selection ends at the start of a line, don't indent that line
    if (line.from === to && to > from) break;
    lineStarts.push(line.from);
  }

  if (lineStarts.length === 0) return false;

  const changes = lineStarts.map((lineFrom) => ({ from: lineFrom, to: lineFrom, insert: "\t" }));

  const shiftPos = (pos: number) => {
    let shift = 0;
    for (const lineFrom of lineStarts) {
      if (lineFrom <= pos) shift++;
    }
    return pos + shift;
  };

  const newAnchor = shiftPos(sel.anchor);
  const newHead = shiftPos(sel.head);

  view.dispatch({
    changes,
    selection: { anchor: newAnchor, head: newHead },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle Shift-Tab inside a code block by removing a leading tab.
 * For selections, outdent each selected line if it starts with a tab.
 */
export function handleShiftTabInCodeBlock(view: EditorView): boolean {
  if (!isCursorInCodeBlock(view)) return false;

  const state = view.state;
  const sel = state.selection.main;

  // Collapsed selection: remove a single tab before cursor if present
  if (sel.empty) {
    const pos = sel.head;
    if (pos <= 0) return false;
    const before = state.doc.sliceString(pos - 1, pos);
    if (before !== "\t") return false;
    view.dispatch({
      changes: { from: pos - 1, to: pos, insert: "" },
      selection: { anchor: pos - 1 },
      scrollIntoView: true,
    });
    return true;
  }

  const from = Math.min(sel.anchor, sel.head);
  const to = Math.max(sel.anchor, sel.head);
  const startLine = state.doc.lineAt(from);
  const endLine = state.doc.lineAt(to);
  const lineStarts: number[] = [];

  for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
    const line = state.doc.line(lineNum);
    if (line.from === to && to > from) break;
    if (line.text.startsWith("\t")) {
      lineStarts.push(line.from);
    }
  }

  if (lineStarts.length === 0) return false;

  const changes = lineStarts.map((lineFrom) => ({ from: lineFrom, to: lineFrom + 1, insert: "" }));

  const shiftPos = (pos: number) => {
    let shift = 0;
    for (const lineFrom of lineStarts) {
      if (lineFrom < pos) shift--;
    }
    return pos + shift;
  };

  const newAnchor = shiftPos(sel.anchor);
  const newHead = shiftPos(sel.head);

  view.dispatch({
    changes,
    selection: { anchor: newAnchor, head: newHead },
    scrollIntoView: true,
  });
  return true;
}
