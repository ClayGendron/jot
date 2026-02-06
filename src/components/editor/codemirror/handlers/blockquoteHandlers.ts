/**
 * Blockquote Handlers
 *
 * Handles blockquote creation, continuation, and navigation.
 */

import type { EditorView } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import { getListInfo } from "./listHandlers";

// ===========================================
// BLOCKQUOTE INFO
// ===========================================

/**
 * Blockquote marker pattern:
 * One or more > at the start of a line, optionally followed by space
 */
const BLOCKQUOTE_REGEX = /^((?:>\s*)+)/;

export interface BlockquoteInfo {
  isBlockquote: boolean;
  level: number;
  marker: string;
  contentStart: number;
}

/**
 * Get blockquote info for a line
 */
export function getBlockquoteInfo(line: { text: string; from: number }): BlockquoteInfo | null {
  const match = line.text.match(BLOCKQUOTE_REGEX);
  if (!match) return null;

  const marker = match[1];
  const level = (marker.match(/>/g) || []).length;

  return {
    isBlockquote: true,
    level,
    marker,
    contentStart: line.from + marker.length,
  };
}

/**
 * Compute the continuation line prefix for a line inside a container
 * (blockquote, list, or nested blockquote>list).
 */
export function getContainerLinePrefix(
  _state: EditorState,
  line: { text: string; from: number }
): { linePrefix: string; blankLinePrefix: string } {
  const bq = getBlockquoteInfo(line);

  if (bq) {
    // Strip blockquote prefix, check for inner list
    const afterBq = {
      text: line.text.slice(bq.marker.length),
      from: line.from + bq.marker.length,
    };
    const innerLi = getListInfo(afterBq);
    if (innerLi) {
      // Nested: "> - " -> continuation ">   "
      const listIndent = " ".repeat(innerLi.contentStart - afterBq.from);
      return {
        linePrefix: bq.marker + listIndent,
        blankLinePrefix: bq.marker + listIndent,
      };
    }
    return {
      linePrefix: bq.marker,
      blankLinePrefix: bq.marker.trimEnd(),
    };
  }

  const li = getListInfo(line);
  if (li) {
    const indent = " ".repeat(li.contentStart - line.from);
    return {
      linePrefix: indent,
      blankLinePrefix: indent,
    };
  }

  return { linePrefix: "", blankLinePrefix: "" };
}

// ===========================================
// BLOCKQUOTE HANDLERS
// ===========================================

/**
 * Handle Enter in blockquote - continue or exit
 */
export function handleEnterInBlockquote(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const quoteInfo = getBlockquoteInfo(line);

  if (!quoteInfo) return false;

  const content = line.text.slice(quoteInfo.marker.length);

  if (content.trim() === "") {
    // Empty blockquote line - exit
    if (line.number <= 1) {
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
        selection: { anchor: line.from },
        scrollIntoView: true,
      });
    } else {
      const prevLine = state.doc.line(line.number - 1);
      view.dispatch({
        changes: { from: prevLine.to, to: line.to, insert: "\n\n" },
        selection: { anchor: prevLine.to + 2 },
        scrollIntoView: true,
      });
    }
    return true;
  }

  // At end of blockquote line - create new line
  if (pos === line.to) {
    const newMarker = quoteInfo.marker;
    view.dispatch({
      changes: { from: pos, to: pos, insert: `\n${newMarker}` },
      selection: { anchor: pos + 1 + newMarker.length },
      scrollIntoView: true,
    });
    return true;
  }

  // In middle - split
  if (pos > quoteInfo.contentStart && pos < line.to) {
    const afterCursor = line.text.slice(pos - line.from);
    const newMarker = quoteInfo.marker;

    view.dispatch({
      changes: { from: pos, to: line.to, insert: `\n${newMarker}${afterCursor}` },
      selection: { anchor: pos + 1 + newMarker.length },
      scrollIntoView: true,
    });
    return true;
  }

  // At start of content - insert new line above
  if (pos === quoteInfo.contentStart) {
    const marker = quoteInfo.marker;
    view.dispatch({
      changes: { from: line.from, to: line.from, insert: `${marker}\n` },
      selection: { anchor: quoteInfo.contentStart + marker.length + 1 },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

/**
 * Handle Backspace at start of blockquote content
 */
export function handleBackspaceInBlockquote(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;

  if (!state.selection.main.empty) return false;

  const line = state.doc.lineAt(pos);
  const quoteInfo = getBlockquoteInfo(line);

  if (!quoteInfo) return false;
  if (pos !== quoteInfo.contentStart) return false;

  const content = line.text.slice(quoteInfo.marker.length);
  const isEmptyBlockquote = content.trim() === "";

  if (isEmptyBlockquote) {
    view.dispatch({
      changes: { from: line.from, to: quoteInfo.contentStart, insert: "" },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  if (line.number <= 1) {
    view.dispatch({
      changes: { from: line.from, to: quoteInfo.contentStart, insert: "" },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  const prevLine = state.doc.line(line.number - 1);
  const prevQuoteInfo = getBlockquoteInfo(prevLine);

  if (prevQuoteInfo) {
    view.dispatch({
      changes: { from: prevLine.to, to: quoteInfo.contentStart, insert: " " },
      selection: { anchor: prevLine.to },
      scrollIntoView: true,
    });
    return true;
  }

  if (prevLine.text.trim() === "") {
    let targetLineNum = line.number - 1;
    while (targetLineNum >= 1) {
      const targetLine = state.doc.line(targetLineNum);
      if (targetLine.text.trim() !== "") {
        view.dispatch({
          changes: { from: targetLine.to, to: quoteInfo.contentStart, insert: "" },
          selection: { anchor: targetLine.to },
          scrollIntoView: true,
        });
        return true;
      }
      targetLineNum--;
    }
    view.dispatch({
      changes: { from: line.from, to: quoteInfo.contentStart, insert: "" },
      selection: { anchor: line.from },
      scrollIntoView: true,
    });
    return true;
  }

  view.dispatch({
    changes: { from: prevLine.to, to: quoteInfo.contentStart, insert: "" },
    selection: { anchor: prevLine.to },
    scrollIntoView: true,
  });
  return true;
}
