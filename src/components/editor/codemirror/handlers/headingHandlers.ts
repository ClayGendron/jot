/**
 * Heading Handlers
 *
 * Handles heading level changes and backspace at heading start.
 */

import type { EditorView } from "@codemirror/view";
import { HEADING_PREFIX_RE } from "../utils/sharedHelpers";
import { getListInfo } from "./listHandlers";
import { getBlockquoteInfo } from "./blockquoteHandlers";

/**
 * Set heading level for current line
 * - Same level: toggle off (remove heading)
 * - Different level: change to new level
 * - Plain text: add heading markers
 * - List/blockquote: don't convert (return false)
 */
export function setHeadingLevel(view: EditorView, level: 1 | 2 | 3 | 4 | 5 | 6): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const lineText = line.text;

  // Don't convert list items or blockquotes
  if (getListInfo(line)) return false;
  if (getBlockquoteInfo(line)) return false;

  const headingMatch = lineText.match(HEADING_PREFIX_RE);

  if (headingMatch) {
    const existingLevel = headingMatch[1].length;
    const existingMarkerLength = headingMatch[0].length;
    const cursorOffsetFromContent = pos - (line.from + existingMarkerLength);

    if (existingLevel === level) {
      // Same level - toggle off
      view.dispatch({
        changes: { from: line.from, to: line.from + existingMarkerLength, insert: "" },
        selection: { anchor: line.from + Math.max(0, cursorOffsetFromContent) },
        scrollIntoView: true,
      });
    } else {
      // Different level - change
      const newMarker = "#".repeat(level) + " ";
      view.dispatch({
        changes: { from: line.from, to: line.from + existingMarkerLength, insert: newMarker },
        selection: { anchor: line.from + newMarker.length + Math.max(0, cursorOffsetFromContent) },
        scrollIntoView: true,
      });
    }
    return true;
  }

  // Plain text - add heading
  const cursorOffsetFromLineStart = pos - line.from;
  const newMarker = "#".repeat(level) + " ";
  view.dispatch({
    changes: { from: line.from, to: line.from, insert: newMarker },
    selection: { anchor: line.from + newMarker.length + cursorOffsetFromLineStart },
    scrollIntoView: true,
  });
  return true;
}

// Heading level wrapper functions for keymap
export function setHeading1(view: EditorView): boolean { return setHeadingLevel(view, 1); }
export function setHeading2(view: EditorView): boolean { return setHeadingLevel(view, 2); }
export function setHeading3(view: EditorView): boolean { return setHeadingLevel(view, 3); }
export function setHeading4(view: EditorView): boolean { return setHeadingLevel(view, 4); }
export function setHeading5(view: EditorView): boolean { return setHeadingLevel(view, 5); }
export function setHeading6(view: EditorView): boolean { return setHeadingLevel(view, 6); }

/**
 * Handle backspace at start of heading content
 */
export function handleBackspaceAtHeadingStart(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const lineText = line.text;
  const headingMatch = lineText.match(HEADING_PREFIX_RE);

  if (!headingMatch) return false;

  const contentStart = line.from + headingMatch[0].length;
  if (pos !== contentStart) return false;

  if (line.number <= 1) {
    view.dispatch({
      changes: { from: line.from, to: contentStart, insert: "" },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  // Find content above (skip blank lines)
  let targetLineNum = line.number - 1;
  while (targetLineNum >= 1) {
    const targetLine = state.doc.line(targetLineNum);
    if (targetLine.text.trim() !== "") {
      view.dispatch({
        changes: { from: targetLine.to, to: contentStart, insert: "" },
        selection: { anchor: targetLine.to },
        scrollIntoView: true,
      });
      return true;
    }
    targetLineNum--;
  }

  // All lines above are blank
  const firstLine = state.doc.line(1);
  view.dispatch({
    changes: { from: firstLine.from, to: contentStart, insert: "" },
    selection: { anchor: 0 },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Get the content start position for any line (handles headings, lists, blockquotes)
 */
export function getContentStartForLine(line: { from: number; text: string }): number {
  const headingMatch = line.text.match(HEADING_PREFIX_RE);
  if (headingMatch) {
    return line.from + headingMatch[0].length;
  }

  const quoteInfo = getBlockquoteInfo(line);
  if (quoteInfo) {
    return quoteInfo.contentStart;
  }

  const listInfo = getListInfo(line);
  if (listInfo) {
    return listInfo.contentStart;
  }

  return line.from;
}
