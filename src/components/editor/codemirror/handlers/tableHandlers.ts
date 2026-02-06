/**
 * Table Handlers
 *
 * Handles table navigation, row/column operations, and table insertion.
 */

import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  collectTableExtents,
  isInTable,
} from "../utils/sharedHelpers";
import { getContainerLinePrefix } from "./blockquoteHandlers";
import {
  getCurrentTableInfo,
  generateTableMarkdown,
  getAllTableCells,
  type TableInfo,
  type TableCellInfo,
} from "../parsers/tableParser";

// ===========================================
// TABLE MUTATION OPERATIONS
// ===========================================

/**
 * Add a new empty row to the end of the table body.
 */
export function addTableRow(view: EditorView, info: TableInfo): void {
  const headers = info.headerCells.map(c => c.content);
  const rows = info.bodyRows.map(bodyRow => bodyRow.map(c => c.content));
  rows.push(Array(info.columnCount).fill(""));
  const newMarkdown = generateTableMarkdown(headers, rows, info.columnAlignments, info.linePrefix);
  view.dispatch({ changes: { from: info.from, to: info.to, insert: newMarkdown } });
}

/**
 * Remove the last row from the table body.
 */
export function removeTableRow(view: EditorView, info: TableInfo): void {
  if (info.bodyRows.length === 0) return;
  const headers = info.headerCells.map(c => c.content);
  const rows = info.bodyRows.map(bodyRow => bodyRow.map(c => c.content));
  rows.pop();
  const newMarkdown = generateTableMarkdown(headers, rows, info.columnAlignments, info.linePrefix);
  view.dispatch({ changes: { from: info.from, to: info.to, insert: newMarkdown } });
}

/**
 * Add a new empty column to the right of the table.
 */
export function addTableColumn(view: EditorView, info: TableInfo): void {
  // New columns are blank - user fills in the header
  const headers = [...info.headerCells.map(c => c.content), ""];
  const rows = info.bodyRows.map(bodyRow => [...bodyRow.map(c => c.content), ""]);
  const alignments = [...info.columnAlignments, "none" as const];
  const newMarkdown = generateTableMarkdown(headers, rows, alignments, info.linePrefix);
  view.dispatch({ changes: { from: info.from, to: info.to, insert: newMarkdown } });
}

/**
 * Remove the last column from the table.
 */
export function removeTableColumn(view: EditorView, info: TableInfo): void {
  if (info.columnCount <= 1) return;
  const headers = info.headerCells.map(c => c.content).slice(0, -1);
  const rows = info.bodyRows.map(bodyRow => bodyRow.map(c => c.content).slice(0, -1));
  const alignments = info.columnAlignments.slice(0, -1);
  const newMarkdown = generateTableMarkdown(headers, rows, alignments, info.linePrefix);
  view.dispatch({ changes: { from: info.from, to: info.to, insert: newMarkdown } });
}

// ===========================================
// CURSOR POSITION HELPERS
// ===========================================

/**
 * Check if cursor is inside a table.
 */
export function isCursorInTable(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const extents = collectTableExtents(view.state);
  return isInTable(pos, extents);
}

/**
 * Find the current cell containing the cursor in a table.
 * Returns null if cursor is not in any cell.
 */
function findCurrentCell(
  view: EditorView,
  allCells: TableCellInfo[],
  pos: number
): TableCellInfo | null {
  // Direct hit - cursor is within cell boundaries
  for (const cell of allCells) {
    if (pos >= cell.from && pos <= cell.to) {
      return cell;
    }
  }

  // Cursor isn't in any cell directly, find nearest on same line
  const cursorLine = view.state.doc.lineAt(pos);
  let bestCell: TableCellInfo | null = null;
  let bestDist = Infinity;
  for (const cell of allCells) {
    const cellLine = view.state.doc.lineAt(cell.from);
    if (cellLine.number !== cursorLine.number) continue;
    const dist = Math.min(Math.abs(pos - cell.from), Math.abs(pos - cell.to));
    if (dist < bestDist) {
      bestDist = dist;
      bestCell = cell;
    }
  }
  return bestCell;
}

/**
 * Find the current cell index in the cells array.
 * Returns -1 if cursor is not in any cell.
 */
function findCurrentCellIndex(
  view: EditorView,
  cells: TableCellInfo[],
  pos: number
): number {
  // Direct hit
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (pos >= cell.from && pos <= cell.to) {
      return i;
    }
  }

  // Find nearest on same line
  const cursorLine = view.state.doc.lineAt(pos);
  let bestIdx = -1;
  let bestDist = Infinity;
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const cellLine = view.state.doc.lineAt(cell.from);
    if (cellLine.number !== cursorLine.number) continue;
    const dist = Math.min(Math.abs(pos - cell.from), Math.abs(pos - cell.to));
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Select a cell - either cursor at position for empty, or range for content.
 */
function selectCell(view: EditorView, cell: TableCellInfo): void {
  view.dispatch({
    selection: cell.from === cell.to
      ? EditorSelection.cursor(cell.from)
      : EditorSelection.range(cell.from, cell.to),
  });
}

// ===========================================
// TABLE NAVIGATION HANDLERS
// ===========================================

/**
 * Handle Tab key when cursor is inside a table.
 * Moves cursor to the next cell (left-to-right, top-to-bottom).
 * If at the last cell, adds a new row and moves to its first cell.
 */
export function handleTabInTable(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const extents = collectTableExtents(view.state);
  const tableExtent = extents.find(e => pos >= e.from && pos <= e.to);
  if (!tableExtent) return false;

  const info = getCurrentTableInfo(view, tableExtent.from);
  if (!info) return false;

  const cells = getAllTableCells(info);
  if (cells.length === 0) return false;

  const currentIdx = findCurrentCellIndex(view, cells, pos);
  if (currentIdx === -1) return false;

  const nextIdx = currentIdx + 1;

  if (nextIdx < cells.length) {
    // Move to next cell — select its content
    selectCell(view, cells[nextIdx]);
    return true;
  }

  // At last cell — add a new row and move to its first cell
  const originalTableFrom = info.from;
  addTableRow(view, info);

  // Re-parse using the stored position to find the correct table
  const newInfo = getCurrentTableInfo(view, originalTableFrom);
  if (!newInfo || newInfo.bodyRows.length === 0) return true;

  const lastRow = newInfo.bodyRows[newInfo.bodyRows.length - 1];
  if (lastRow.length > 0) {
    view.dispatch({
      selection: EditorSelection.cursor(lastRow[0].from),
    });
  }
  return true;
}

/**
 * Handle Shift+Tab key when cursor is inside a table.
 * Moves cursor to the previous cell (right-to-left, bottom-to-top).
 * If at the first cell, does nothing (returns true to consume the key).
 */
export function handleShiftTabInTable(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const extents = collectTableExtents(view.state);
  const tableExtent = extents.find(e => pos >= e.from && pos <= e.to);
  if (!tableExtent) return false;

  const info = getCurrentTableInfo(view, tableExtent.from);
  if (!info) return false;

  const cells = getAllTableCells(info);
  if (cells.length === 0) return false;

  const currentIdx = findCurrentCellIndex(view, cells, pos);
  if (currentIdx === -1) return false;

  const prevIdx = currentIdx - 1;

  if (prevIdx >= 0) {
    // Move to previous cell — select its content
    selectCell(view, cells[prevIdx]);
  }
  // At first cell — consume the key but do nothing
  return true;
}

/**
 * Handle Enter key when cursor is inside a table.
 * Moves cursor down to the next row in the same column.
 * - In header: move to first body row, same column
 * - In body (not last row): move to next row, same column
 * - In last body row: create new row and move to the new cell below
 */
export function handleEnterInTable(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const extents = collectTableExtents(view.state);
  const tableExtent = extents.find(e => pos >= e.from && pos <= e.to);
  if (!tableExtent) return false;

  const info = getCurrentTableInfo(view, tableExtent.from);
  if (!info) return false;

  const allCells = getAllTableCells(info);
  const currentCell = findCurrentCell(view, allCells, pos);
  if (!currentCell) return false;

  const col = currentCell.col;

  if (currentCell.isHeader) {
    // In header — move to first body row, same column
    if (info.bodyRows.length > 0 && info.bodyRows[0].length > col) {
      selectCell(view, info.bodyRows[0][col]);
    }
    return true;
  }

  // In body — find current row index
  const bodyRowIdx = currentCell.row - 1; // row 0 is header, so body row 0 = currentCell.row 1

  if (bodyRowIdx < info.bodyRows.length - 1) {
    // Not last row — move to next row, same column
    const nextRow = info.bodyRows[bodyRowIdx + 1];
    if (nextRow.length > col) {
      selectCell(view, nextRow[col]);
    }
    return true;
  }

  // At last body row — add new row and move to the new cell
  const originalTableFrom = info.from;
  addTableRow(view, info);

  // Re-parse using the stored position to find the correct table
  const newInfo = getCurrentTableInfo(view, originalTableFrom);
  if (!newInfo || newInfo.bodyRows.length === 0) return true;

  const lastRow = newInfo.bodyRows[newInfo.bodyRows.length - 1];
  if (lastRow.length > col) {
    view.dispatch({
      selection: EditorSelection.cursor(lastRow[col].from),
    });
  }
  return true;
}

/**
 * Handle Arrow Up key when cursor is inside a table.
 * Moves cursor to the cell above in the same column.
 * If at the first row (header), exits the table and places cursor before it.
 */
export function handleArrowUpInTable(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const extents = collectTableExtents(view.state);
  const tableExtent = extents.find(e => pos >= e.from && pos <= e.to);
  if (!tableExtent) return false;

  const info = getCurrentTableInfo(view, tableExtent.from);
  if (!info) return false;

  const allCells = getAllTableCells(info);
  const currentCell = findCurrentCell(view, allCells, pos);
  if (!currentCell) return false;

  const col = currentCell.col;

  if (currentCell.isHeader) {
    // At header — exit table, place cursor before it
    const beforeTable = info.from > 0 ? info.from - 1 : 0;
    view.dispatch({
      selection: EditorSelection.cursor(beforeTable),
    });
    return true;
  }

  // In body — find current row index
  const bodyRowIdx = currentCell.row - 1;

  if (bodyRowIdx === 0) {
    // First body row — move up to header, same column
    if (info.headerCells.length > col) {
      selectCell(view, info.headerCells[col]);
    }
    return true;
  }

  // Move to previous body row, same column
  const prevRow = info.bodyRows[bodyRowIdx - 1];
  if (prevRow.length > col) {
    selectCell(view, prevRow[col]);
  }
  return true;
}

/**
 * Handle Arrow Down key when cursor is inside a table.
 * Moves cursor to the cell below in the same column.
 * If at the last row, exits the table and places cursor after it.
 */
export function handleArrowDownInTable(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const extents = collectTableExtents(view.state);
  const tableExtent = extents.find(e => pos >= e.from && pos <= e.to);
  if (!tableExtent) return false;

  const info = getCurrentTableInfo(view, tableExtent.from);
  if (!info) return false;

  const allCells = getAllTableCells(info);
  const currentCell = findCurrentCell(view, allCells, pos);
  if (!currentCell) return false;

  const col = currentCell.col;

  if (currentCell.isHeader) {
    // In header — move down to first body row, same column
    if (info.bodyRows.length > 0 && info.bodyRows[0].length > col) {
      selectCell(view, info.bodyRows[0][col]);
    } else {
      // No body rows — exit table
      const afterTable = info.to < view.state.doc.length ? info.to + 1 : info.to;
      view.dispatch({
        selection: EditorSelection.cursor(afterTable),
      });
    }
    return true;
  }

  // In body — find current row index
  const bodyRowIdx = currentCell.row - 1;

  if (bodyRowIdx >= info.bodyRows.length - 1) {
    // At last body row — exit table, place cursor after it
    const afterTable = info.to < view.state.doc.length ? info.to + 1 : info.to;
    view.dispatch({
      selection: EditorSelection.cursor(afterTable),
    });
    return true;
  }

  // Move to next body row, same column
  const nextRow = info.bodyRows[bodyRowIdx + 1];
  if (nextRow.length > col) {
    selectCell(view, nextRow[col]);
  }
  return true;
}

/**
 * Handle Escape key when cursor is inside a table.
 * Exits the table and places cursor after it.
 */
export function handleEscapeInTable(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const extents = collectTableExtents(view.state);
  const tableExtent = extents.find(e => pos >= e.from && pos <= e.to);
  if (!tableExtent) return false;

  const info = getCurrentTableInfo(view, tableExtent.from);
  if (!info) return false;

  // Exit table — place cursor after it
  const afterTable = info.to < view.state.doc.length ? info.to + 1 : info.to;
  view.dispatch({
    selection: EditorSelection.cursor(afterTable),
  });
  return true;
}

// ===========================================
// TABLE INSERTION
// ===========================================

/**
 * Check if cursor is inside a code block.
 * Uses the code block helper from getCodeBlockAtLine.
 */
function isCursorInCodeBlock(view: EditorView): boolean {
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  return getCodeBlockAtLine(view.state, line.number) !== null;
}

/**
 * Regex to match fenced code block start: ```language
 */
const CODE_FENCE_REGEX = /^(`{3,})(\w*)$/;

/**
 * Check if a line is the start of a fenced code block
 */
function isCodeFenceStart(lineText: string): { fence: string; language: string } | null {
  const match = lineText.match(CODE_FENCE_REGEX);
  if (match) {
    return { fence: match[1], language: match[2] || "" };
  }
  return null;
}

/**
 * Get code block range if cursor is on a code block line
 */
export function getCodeBlockAtLine(
  state: { doc: { lines: number; line: (n: number) => { from: number; to: number; text: string } } },
  lineNum: number
): { from: number; to: number; code: string; language: string } | null {
  const doc = state.doc;
  const totalLines = doc.lines;
  const line = doc.line(lineNum);
  const fenceStart = isCodeFenceStart(line.text);

  if (fenceStart) {
    // This is a fence start - find the closing fence
    const fence = fenceStart.fence;
    for (let i = lineNum + 1; i <= totalLines; i++) {
      const checkLine = doc.line(i);
      if (checkLine.text.startsWith(fence)) {
        const codeLines: string[] = [];
        for (let j = lineNum + 1; j < i; j++) {
          codeLines.push(doc.line(j).text);
        }
        return {
          from: line.from,
          to: checkLine.to,
          code: codeLines.join("\n"),
          language: fenceStart.language,
        };
      }
    }
    return null;
  }

  // Check if this line is inside a code block
  for (let i = lineNum - 1; i >= 1; i--) {
    const checkLine = doc.line(i);
    const maybeFence = isCodeFenceStart(checkLine.text);
    if (maybeFence) {
      const fence = maybeFence.fence;
      for (let j = i + 1; j <= totalLines; j++) {
        const closeLine = doc.line(j);
        if (closeLine.text.startsWith(fence)) {
          if (lineNum > i && lineNum <= j) {
            const codeLines: string[] = [];
            for (let k = i + 1; k < j; k++) {
              codeLines.push(doc.line(k).text);
            }
            return {
              from: checkLine.from,
              to: closeLine.to,
              code: codeLines.join("\n"),
              language: maybeFence.language,
            };
          }
          break;
        }
      }
    }
  }

  return null;
}

/**
 * Insert a default GFM table at cursor position.
 * Default: 2 columns, 2 body rows, with placeholder headers.
 * Ensures blank lines before/after for proper markdown parsing.
 * Returns false if cursor is inside a code block or table (no nesting).
 */
export function insertTable(view: EditorView, rows = 2, cols = 2): boolean {
  if (isCursorInCodeBlock(view) || isCursorInTable(view)) return false;

  const pos = view.state.selection.main.head;
  const doc = view.state.doc;
  const line = doc.lineAt(pos);

  // Compute container prefix for the current line
  const { linePrefix, blankLinePrefix } = getContainerLinePrefix(view.state, line);

  // Build default table
  const headers: string[] = [];
  for (let c = 0; c < cols; c++) {
    headers.push(`Header ${c + 1}`);
  }
  const bodyRows: string[][] = [];
  for (let r = 0; r < rows; r++) {
    bodyRows.push(Array(cols).fill(""));
  }
  const alignments: ("left" | "center" | "right" | "none")[] = Array(cols).fill("none");
  const rawTable = generateTableMarkdown(headers, bodyRows, alignments);
  // Apply linePrefix to ALL lines (since this is a fresh insertion, no pre-existing prefix)
  const tableMd = rawTable.split("\n").map(l => linePrefix + l).join("\n");

  // Ensure blank lines before/after
  let prefix = "";
  const suffix = "\n";
  if (line.text.trim() !== "" || pos !== line.from) {
    // Current line has content — insert after with blank line separator
    prefix = "\n" + blankLinePrefix + "\n";
  } else if (line.number > 1) {
    const prevLine = doc.line(line.number - 1);
    if (prevLine.text.trim() !== "") {
      prefix = "\n";
    }
  }

  const insertText = prefix + tableMd + suffix;
  view.dispatch({
    changes: { from: pos, insert: insertText },
    selection: { anchor: pos + insertText.length },
  });

  return true;
}
