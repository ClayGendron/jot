/**
 * Table Parser
 *
 * Parses GFM tables from the Lezer AST and generates markdown.
 */

import type { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { SyntaxNode } from "@lezer/common";
import { syntaxTree } from "@codemirror/language";
import { getContainerLinePrefix } from "../handlers/blockquoteHandlers";

// ===========================================
// TABLE DATA MODEL
// ===========================================

export interface TableCellInfo {
  row: number;       // 0 = header, 1+ = body
  col: number;
  from: number;      // doc position of cell content start
  to: number;        // doc position of cell content end
  content: string;   // raw markdown content
  isHeader: boolean;
}

export interface TableInfo {
  from: number;              // Table node start
  to: number;                // End of last row line
  headerCells: TableCellInfo[];
  delimiterFrom: number;
  delimiterTo: number;
  bodyRows: TableCellInfo[][];
  columnCount: number;
  rowCount: number;          // header + body (not delimiter)
  columnAlignments: ("left" | "center" | "right" | "none")[];
  linePrefix: string;        // continuation prefix
  blankLinePrefix: string;   // prefix for blank separator lines
}

// ===========================================
// PARSING HELPERS
// ===========================================

/**
 * Parse alignment markers from a GFM table delimiter row.
 */
export function parseAlignments(delimText: string): ("left" | "center" | "right" | "none")[] {
  const segments = delimText.split("|").map(s => s.trim()).filter(s => s.length > 0);
  return segments.map(seg => {
    const left = seg.startsWith(":");
    const right = seg.endsWith(":");
    if (left && right) return "center";
    if (left) return "left";
    if (right) return "right";
    return "none";
  });
}

/**
 * Extract cell positions from a table row by parsing pipes.
 */
export function extractCellPositions(rowText: string): Array<{ from: number; to: number }> {
  const positions: Array<{ from: number; to: number }> = [];
  let inCell = false;
  let cellStart = 0;

  for (let i = 0; i < rowText.length; i++) {
    if (rowText[i] === "|") {
      if (inCell) {
        positions.push({ from: cellStart, to: i });
      }
      inCell = true;
      cellStart = i + 1;
    }
  }

  return positions;
}

/**
 * Parse a GFM table from the Lezer AST Table node.
 */
export function parseTableFromAST(
  state: EditorState,
  tableNode: { from: number; to: number; node: SyntaxNode }
): TableInfo | null {
  const doc = state.doc;
  const headerCells: TableCellInfo[] = [];
  let delimiterFrom = -1;
  let delimiterTo = -1;
  let delimText = "";
  const bodyRows: TableCellInfo[][] = [];
  let maxTo = tableNode.from;

  let child = tableNode.node.firstChild;
  let bodyRowIndex = 0;

  while (child) {
    if (child.name === "TableHeader") {
      if (child.to > maxTo) maxTo = child.to;
      const headerLine = doc.lineAt(child.from);
      const headerText = doc.sliceString(headerLine.from, headerLine.to);
      const cellPositions = extractCellPositions(headerText);

      for (let colIndex = 0; colIndex < cellPositions.length; colIndex++) {
        const { from: relFrom, to: relTo } = cellPositions[colIndex];
        const absFrom = headerLine.from + relFrom;
        const absTo = headerLine.from + relTo;
        const content = doc.sliceString(absFrom, absTo).trim();
        headerCells.push({
          row: 0,
          col: colIndex,
          from: absFrom,
          to: absTo,
          content,
          isHeader: true,
        });
      }
    } else if (child.name === "TableDelimiter") {
      const childLine = doc.lineAt(child.from);
      if (child.from === childLine.from || doc.sliceString(childLine.from, child.from).trim() === "") {
        delimiterFrom = childLine.from;
        delimiterTo = childLine.to;
        delimText = doc.sliceString(delimiterFrom, delimiterTo);
        if (child.to > maxTo) maxTo = child.to;
      }
    } else if (child.name === "TableRow") {
      const rowText = doc.sliceString(child.from, child.to);
      if (!rowText.includes("|")) {
        child = child.nextSibling;
        continue;
      }
      if (child.to > maxTo) maxTo = child.to;
      const rowLine = doc.lineAt(child.from);
      const fullRowText = doc.sliceString(rowLine.from, rowLine.to);
      const cellPositions = extractCellPositions(fullRowText);

      const rowCells: TableCellInfo[] = [];
      for (let colIndex = 0; colIndex < cellPositions.length; colIndex++) {
        const { from: relFrom, to: relTo } = cellPositions[colIndex];
        const absFrom = rowLine.from + relFrom;
        const absTo = rowLine.from + relTo;
        const content = doc.sliceString(absFrom, absTo).trim();
        rowCells.push({
          row: bodyRowIndex + 1,
          col: colIndex,
          from: absFrom,
          to: absTo,
          content,
          isHeader: false,
        });
      }
      bodyRows.push(rowCells);
      bodyRowIndex++;
    }

    child = child.nextSibling;
  }

  if (headerCells.length === 0 || delimiterFrom === -1) return null;

  const columnCount = headerCells.length;
  const alignments = parseAlignments(delimText);
  const trueTo = doc.lineAt(maxTo).to;
  const firstLine = doc.lineAt(tableNode.from);
  const { linePrefix, blankLinePrefix } = getContainerLinePrefix(state, firstLine);

  return {
    from: tableNode.from,
    to: trueTo,
    headerCells,
    delimiterFrom,
    delimiterTo,
    bodyRows,
    columnCount,
    rowCount: 1 + bodyRows.length,
    columnAlignments: alignments.length >= columnCount
      ? alignments.slice(0, columnCount)
      : [...alignments, ...Array(columnCount - alignments.length).fill("none" as const)],
    linePrefix,
    blankLinePrefix,
  };
}

/**
 * Re-parse TableInfo from the current editor state at the given position.
 */
export function getCurrentTableInfo(view: EditorView, tableFrom: number): TableInfo | null {
  const state = view.state;
  let found: TableInfo | null = null;
  syntaxTree(state).iterate({
    enter(node) {
      if (found) return false;
      if (node.name === "Table") {
        if (node.from <= tableFrom && node.to >= tableFrom) {
          found = parseTableFromAST(state, { from: node.from, to: node.to, node: node.node });
        }
      }
    },
  });
  return found;
}

// ===========================================
// TABLE GENERATION
// ===========================================

/**
 * Generate GFM table markdown from structured data.
 */
export function generateTableMarkdown(
  headers: string[],
  rows: string[][],
  alignments: ("left" | "center" | "right" | "none")[],
  continuationPrefix = ""
): string {
  const colCount = headers.length;

  // Calculate column widths (minimum 3 for delimiter dashes)
  const widths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let maxW = Math.max(3, headers[c].length);
    for (const row of rows) {
      const cellLen = (row[c] || "").length;
      if (cellLen > maxW) maxW = cellLen;
    }
    widths.push(maxW);
  }

  // Build header line
  const headerLine = "| " + headers.map((h, i) => h.padEnd(widths[i])).join(" | ") + " |";

  // Build delimiter line with alignment
  const delimLine = "| " + widths.map((w, i) => {
    const align = alignments[i] || "none";
    const dashes = "-".repeat(w);
    if (align === "center") return ":" + dashes.slice(1, -1) + ":";
    if (align === "left") return ":" + dashes.slice(1);
    if (align === "right") return dashes.slice(0, -1) + ":";
    return dashes;
  }).join(" | ") + " |";

  // Build body lines
  const bodyLines = rows.map(row =>
    "| " + headers.map((_, i) => (row[i] || "").padEnd(widths[i])).join(" | ") + " |"
  );

  const lines = [headerLine, delimLine, ...bodyLines];
  return lines.map((l, i) => i === 0 ? l : continuationPrefix + l).join("\n");
}

/**
 * Get all data cells (header + body) in reading order.
 */
export function getAllTableCells(info: TableInfo): TableCellInfo[] {
  const cells: TableCellInfo[] = [];
  for (const cell of info.headerCells) cells.push(cell);
  for (const row of info.bodyRows) {
    for (const cell of row) cells.push(cell);
  }
  return cells;
}
