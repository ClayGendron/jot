/**
 * Paragraph Handlers
 *
 * Keyboard handlers for paragraph-level operations:
 * - Enter (new paragraph with double newline)
 * - Shift+Enter (soft line break)
 * - Backspace at paragraph boundaries
 * - Delete at line end (merge with next)
 * - Horizontal rule handling
 */

import type { EditorView } from "@codemirror/view";
import { getListInfo, handleEnterInList } from "./listHandlers";
import { getBlockquoteInfo, handleEnterInBlockquote } from "./blockquoteHandlers";
import { HEADING_PREFIX_RE } from "../utils/sharedHelpers";

// ===========================================
// CONSTANTS
// ===========================================

/**
 * Regex to match horizontal rule patterns (---, ***, ___, or longer)
 */
const HR_REGEX = /^([-*_])\1{2,}\s*$/;

// ===========================================
// ENTER HANDLERS
// ===========================================

/**
 * Handle Enter - insert blank line for proper markdown paragraph separation
 *
 * In markdown, paragraphs are separated by blank lines.
 * Enter = new paragraph (double newline)
 * Shift+Enter = soft line break (single newline)
 */
export function handleEnter(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Don't handle if there's a selection
  if (!state.selection.main.empty) return false;

  // Skip if line is empty (already a blank line, just add one newline)
  if (line.text.trim() === "") {
    return false; // Let default behavior handle
  }

  // Check if we're in a list - handle first
  const listInfo = getListInfo(line);
  if (listInfo) {
    return handleEnterInList(view);
  }

  // Check if we're in a blockquote
  const quoteInfo = getBlockquoteInfo(line);
  if (quoteInfo) {
    return handleEnterInBlockquote(view);
  }

  // Check if we're in a heading
  const headingMatch = line.text.match(HEADING_PREFIX_RE);
  if (headingMatch) {
    const contentStart = line.from + headingMatch[0].length;

    // At start of heading content - insert paragraph ABOVE the heading
    if (pos === contentStart) {
      view.dispatch({
        changes: { from: line.from, to: line.from, insert: "\n\n" },
        selection: { anchor: contentStart + 2 }, // Stay at heading content start
        scrollIntoView: true,
      });
      return true;
    }

    // In middle of heading - split into heading + paragraph
    if (pos > contentStart && pos < line.to) {
      const headingPrefix = headingMatch[0]; // e.g., "## "
      const beforeCursor = line.text.slice(headingPrefix.length, pos - line.from);
      const afterCursor = line.text.slice(pos - line.from);

      // Keep text before cursor as heading, text after becomes paragraph
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: `${headingPrefix}${beforeCursor}\n\n${afterCursor}` },
        selection: { anchor: line.from + headingPrefix.length + beforeCursor.length + 2 },
        scrollIntoView: true,
      });
      return true;
    }
  }

  // Default: Insert two newlines to create blank line (new paragraph)
  view.dispatch({
    changes: { from: pos, to: pos, insert: "\n\n" },
    selection: { anchor: pos + 2 },
    scrollIntoView: true,
  });

  return true;
}

/**
 * Handle Shift+Enter - soft line break (single newline, stays in same paragraph)
 */
export function handleShiftEnter(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;

  // Insert single newline
  view.dispatch({
    changes: { from: pos, to: pos, insert: "\n" },
    selection: { anchor: pos + 1 },
    scrollIntoView: true,
  });

  return true;
}

// ===========================================
// HORIZONTAL RULE HANDLERS
// ===========================================

/**
 * Handle Backspace when cursor is at start of line after a horizontal rule
 * Delete the horizontal rule
 */
export function handleBackspaceAfterHorizontalRule(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must have no selection
  if (!state.selection.main.empty) return false;

  // Must be at start of line
  if (pos !== line.from) return false;

  // Must not be first line
  if (line.number <= 1) return false;

  const prevLine = state.doc.line(line.number - 1);
  if (HR_REGEX.test(prevLine.text)) {
    // Delete the HR line and the newline after it, keeping cursor on the resulting blank line
    // This preserves paragraph spacing while removing the HR
    view.dispatch({
      changes: { from: prevLine.from, to: line.from, insert: "" },
      selection: { anchor: prevLine.from },
      scrollIntoView: true,
    });
    return true;
  }

  // Also handle: cursor on blank line, previous line is blank, line before that is HR
  // This handles the case where HR was created with spacing: ---\n\n|
  if (line.text === "" && line.number > 2) {
    const prevPrevLine = state.doc.line(line.number - 2);
    if (prevLine.text === "" && HR_REGEX.test(prevPrevLine.text)) {
      // Delete the HR and the blank line after it, keep one blank line
      view.dispatch({
        changes: { from: prevPrevLine.from, to: prevLine.to + 1, insert: "" },
        selection: { anchor: prevPrevLine.from },
        scrollIntoView: true,
      });
      return true;
    }
  }

  return false;
}

/**
 * Handle Delete when cursor is at end of line before a horizontal rule
 * Delete the horizontal rule
 */
export function handleDeleteBeforeHorizontalRule(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must have no selection
  if (!state.selection.main.empty) return false;

  // Must be at end of line
  if (pos !== line.to) return false;

  // Must not be last line
  if (line.number >= state.doc.lines) return false;

  const nextLine = state.doc.line(line.number + 1);
  if (HR_REGEX.test(nextLine.text)) {
    // Delete the newline and the HR
    view.dispatch({
      changes: { from: line.to, to: nextLine.to, insert: "" },
      scrollIntoView: true,
    });
    return true;
  }
  return false;
}

// ===========================================
// PARAGRAPH BOUNDARY HANDLERS
// ===========================================

/**
 * Get the content start position for any line (handles headings, lists, blockquotes)
 * Returns the position where actual content starts, after any markers
 */
function getContentStartForLine(line: { from: number; text: string }): number {
  // Check for heading: # ## ### etc.
  const headingMatch = line.text.match(HEADING_PREFIX_RE);
  if (headingMatch) {
    return line.from + headingMatch[0].length;
  }

  // Check for blockquote: > or > > etc.
  const quoteInfo = getBlockquoteInfo(line);
  if (quoteInfo) {
    return quoteInfo.contentStart;
  }

  // Check for list item: - * + or 1. 2. etc.
  const listInfo = getListInfo(line);
  if (listInfo) {
    return listInfo.contentStart;
  }

  // No markers, content starts at line start
  return line.from;
}

/**
 * Handle Delete at end of line - merge with next content, removing any markers
 * This handles headings, blockquotes, lists, etc.
 */
export function handleDeleteAtEndOfLine(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);

  // Must be at end of line
  if (pos !== line.to) return false;

  // Must not be the last line
  if (line.number >= state.doc.lines) return false;

  // Find next content line (skip blank lines)
  let targetLineNum = line.number + 1;
  while (targetLineNum <= state.doc.lines) {
    const targetLine = state.doc.line(targetLineNum);
    if (targetLine.text.trim() !== "") {
      // Found content line - get content start (after any markers)
      const targetContentStart = getContentStartForLine(targetLine);

      // Delete from current position to start of target content
      view.dispatch({
        changes: { from: pos, to: targetContentStart, insert: "" },
        selection: { anchor: pos },
        scrollIntoView: true,
      });
      return true;
    }
    targetLineNum++;
  }

  return false;
}

/**
 * Handle backspace at start of paragraph - merge with previous content
 *
 * If cursor is at start of a line and previous lines are blank,
 * delete ALL blank lines to merge paragraphs.
 *
 * Markdown collapses multiple blank lines, so we should too.
 */
export function handleBackspaceAtParagraphStart(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;

  // Must have a selection that's empty (just cursor)
  if (!state.selection.main.empty) return false;

  const line = state.doc.lineAt(pos);

  // Must be at start of line
  if (pos !== line.from) return false;

  // Must not be the first line
  if (line.number <= 1) return false;

  const prevLine = state.doc.line(line.number - 1);

  // Check if previous line is blank
  if (prevLine.text.trim() !== "") return false;

  // Find all consecutive blank lines above
  let firstBlankLineNum = line.number - 1;
  while (firstBlankLineNum > 1) {
    const checkLine = state.doc.line(firstBlankLineNum - 1);
    if (checkLine.text.trim() !== "") break;
    firstBlankLineNum--;
  }

  const firstBlankLine = state.doc.line(firstBlankLineNum);

  // Check what's above all the blank lines
  if (firstBlankLineNum <= 1) {
    // Only blank lines above, delete them all
    view.dispatch({
      changes: { from: firstBlankLine.from, to: line.from, insert: "" },
      selection: { anchor: firstBlankLine.from },
      scrollIntoView: true,
    });
    return true;
  }

  const contentLine = state.doc.line(firstBlankLineNum - 1);

  // Merge content: delete from end of content line to start of current line
  // This works for both headings and paragraphs
  view.dispatch({
    changes: { from: contentLine.to, to: line.from, insert: "" },
    selection: { anchor: contentLine.to },
    scrollIntoView: true,
  });

  return true;
}
