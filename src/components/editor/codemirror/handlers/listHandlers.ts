/**
 * List Handlers
 *
 * Handles list item creation, continuation, and navigation.
 */

import type { EditorView } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";

// ===========================================
// LIST INFO
// ===========================================

/**
 * List marker patterns:
 * - Unordered: -, *, + followed by space
 * - Ordered: 1., 2., etc. followed by space
 * - Task lists: - [ ] or - [x] (checkbox)
 */
const LIST_MARKER_REGEX = /^(\s*)([-*+]|\d+\.)\s(\[[ xX]]\s)?/;

export interface ListInfo {
  isListItem: boolean;
  indent: string;
  marker: string;
  markerWithSpace: string;
  contentStart: number;
  isOrdered: boolean;
  orderNumber: number | null;
  isTask: boolean;
  isTaskChecked: boolean;
  taskMarkerStart: number | null;
}

/**
 * Get list info for a line
 */
export function getListInfo(line: { text: string; from: number }): ListInfo | null {
  const match = line.text.match(LIST_MARKER_REGEX);
  if (!match) return null;

  const indent = match[1];
  const marker = match[2];
  const markerWithSpace = match[0];
  const isOrdered = /^\d+\.$/.test(marker);
  const orderNumber = isOrdered ? parseInt(marker) : null;

  // Task marker detection
  const taskMarkerMatch = match[3];
  const isTask = !!taskMarkerMatch;
  const isTaskChecked = isTask && /\[[xX]]/.test(taskMarkerMatch);
  const taskMarkerStart = isTask ? line.from + indent.length + marker.length + 1 : null;

  return {
    isListItem: true,
    indent,
    marker,
    markerWithSpace,
    contentStart: line.from + markerWithSpace.length,
    isOrdered,
    orderNumber,
    isTask,
    isTaskChecked,
    taskMarkerStart,
  };
}

/**
 * Check if cursor is at the start of list item content
 */
export function isAtListContentStart(state: EditorState): boolean {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);
  if (!listInfo) return false;
  return pos === listInfo.contentStart;
}

/**
 * Get the next order number for an ordered list
 */
function getNextOrderNumber(state: EditorState, lineNumber: number): number {
  const line = state.doc.line(lineNumber);
  const listInfo = getListInfo(line);
  if (listInfo?.isOrdered && listInfo.orderNumber !== null) {
    return listInfo.orderNumber + 1;
  }
  return 1;
}

/**
 * Build a new list marker string for continuing a list
 */
function buildNewListMarker(
  listInfo: ListInfo,
  nextNum: number
): string {
  if (listInfo.isOrdered) {
    return listInfo.isTask
      ? `${listInfo.indent}${nextNum}. [ ] `
      : `${listInfo.indent}${nextNum}. `;
  } else {
    return listInfo.isTask
      ? `${listInfo.indent}${listInfo.marker} [ ] `
      : `${listInfo.indent}${listInfo.marker} `;
  }
}

// ===========================================
// LIST HANDLERS
// ===========================================

/**
 * Handle Enter in list - auto-continue or exit
 */
export function handleEnterInList(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);

  if (!listInfo) return false;

  // Check if list item content is empty
  const content = line.text.slice(listInfo.markerWithSpace.length);

  if (content.trim() === "") {
    // Empty list item - exit list
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

  // At end of list item - create new list item
  if (pos === line.to) {
    const nextNum = getNextOrderNumber(state, line.number);
    const newMarker = buildNewListMarker(listInfo, nextNum);

    view.dispatch({
      changes: { from: pos, to: pos, insert: `\n${newMarker}` },
      selection: { anchor: pos + 1 + newMarker.length },
      scrollIntoView: true,
    });
    return true;
  }

  // In middle of list item - split into two
  if (pos > listInfo.contentStart && pos < line.to) {
    const afterCursor = line.text.slice(pos - line.from);
    const nextNum = getNextOrderNumber(state, line.number);
    const newMarker = buildNewListMarker(listInfo, nextNum);

    view.dispatch({
      changes: { from: pos, to: line.to, insert: `\n${newMarker}${afterCursor}` },
      selection: { anchor: pos + 1 + newMarker.length },
      scrollIntoView: true,
    });
    return true;
  }

  // At start of content - keep marker empty, move content below
  if (pos === listInfo.contentStart) {
    const contentText = line.text.slice(listInfo.markerWithSpace.length);
    const markerOnly = listInfo.markerWithSpace.trimEnd();

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: `${markerOnly}\n\n${contentText}` },
      selection: { anchor: line.from + markerOnly.length + 2 },
      scrollIntoView: true,
    });
    return true;
  }

  return false;
}

/**
 * Handle Backspace at start of list item
 */
export function handleBackspaceInList(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;

  if (!state.selection.main.empty) return false;

  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);

  if (!listInfo) return false;
  if (pos !== listInfo.contentStart) return false;

  const markerStart = line.from + listInfo.indent.length;
  const content = line.text.slice(listInfo.markerWithSpace.length);
  const isEmptyListItem = content.trim() === "";

  if (isEmptyListItem) {
    view.dispatch({
      changes: { from: markerStart, to: listInfo.contentStart, insert: "" },
      selection: { anchor: markerStart },
      scrollIntoView: true,
    });
    return true;
  }

  if (line.number <= 1) {
    view.dispatch({
      changes: { from: markerStart, to: listInfo.contentStart, insert: "" },
      selection: { anchor: markerStart },
      scrollIntoView: true,
    });
    return true;
  }

  const prevLine = state.doc.line(line.number - 1);
  view.dispatch({
    changes: { from: prevLine.to, to: line.to, insert: `\n\n${listInfo.indent}${content}` },
    selection: { anchor: prevLine.to + 2 + listInfo.indent.length },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle Tab in list - indent
 */
export function handleTabInList(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);

  if (!listInfo) return false;

  view.dispatch({
    changes: { from: line.from, to: line.from, insert: "  " },
    selection: { anchor: pos + 2 },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Handle Shift+Tab in list - outdent
 */
export function handleShiftTabInList(view: EditorView): boolean {
  const state = view.state;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);

  if (!listInfo) return false;
  if (listInfo.indent.length === 0) return false;

  const spacesToRemove = Math.min(2, listInfo.indent.length);
  view.dispatch({
    changes: { from: line.from, to: line.from + spacesToRemove, insert: "" },
    selection: { anchor: pos - spacesToRemove },
    scrollIntoView: true,
  });
  return true;
}

/**
 * Toggle a task checkbox between [ ] and [x] states
 */
export function toggleTaskCheckbox(
  view: EditorView,
  markerPos: number,
  currentlyChecked: boolean
): void {
  const newMarker = currentlyChecked ? "[ ]" : "[x]";
  view.dispatch({
    changes: { from: markerPos, to: markerPos + 3, insert: newMarker },
  });
}

/**
 * Toggle task checkbox on current line using Mod+Enter
 */
export function toggleTaskCheckboxOnLine(view: EditorView): boolean {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const listInfo = getListInfo(line);

  if (!listInfo?.isTask || listInfo.taskMarkerStart === null) return false;

  toggleTaskCheckbox(view, listInfo.taskMarkerStart, listInfo.isTaskChecked);
  return true;
}
