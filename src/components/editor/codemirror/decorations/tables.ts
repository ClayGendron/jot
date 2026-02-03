/**
 * Table Decorations for CodeMirror 6
 *
 * Phase 6: GFM tables with minimal mutation, Tab navigation, and WYSIWYG editing.
 *
 * Key behaviors:
 * - Replaces entire table with a TableWidget
 * - Editable cells with Tab/Shift+Tab navigation
 * - Edits commit on blur/Tab only (not keystroke) to avoid focus glitches
 * - Preserves original cell padding (padLeft, padRight)
 * - Preserves existing <br> style per cell (<br>, <br/>, <br />)
 * - Never normalizes table outside the edited cell
 * - Add/remove rows/columns via UI buttons
 */

import { StateField, RangeSetBuilder, type EditorState } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet, WidgetType } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";

/**
 * Column alignment options
 */
export type Alignment = "left" | "center" | "right" | "none";

/**
 * Individual cell data with position tracking for minimal mutation
 */
export interface CellData {
  /** Content of the cell (without surrounding pipes and padding) */
  content: string;
  /** Start position of the content in the document */
  from: number;
  /** End position of the content in the document */
  to: number;
  /** Leading whitespace before content */
  padLeft: string;
  /** Trailing whitespace after content */
  padRight: string;
  /** Style of <br> tags in this cell, if any (<br>, <br/>, <br />) */
  brStyle: string | null;
  /** Row index (0-based, excluding delimiter row) */
  rowIndex: number;
  /** Column index (0-based) */
  colIndex: number;
}

/**
 * Table data for analysis and rendering
 */
export interface TableData {
  /** Start position of the entire table */
  from: number;
  /** End position of the entire table */
  to: number;
  /** Rows of cells (excluding delimiter row) */
  rows: CellData[][];
  /** Column alignments parsed from delimiter row */
  alignment: Alignment[];
  /** Raw delimiter row for preservation */
  delimiterRow: string;
  /** Position of delimiter row */
  delimiterFrom: number;
  delimiterTo: number;
}

/**
 * Detect <br> style in cell content
 */
function detectBrStyle(content: string): string | null {
  const brMatch = content.match(/<br\s*\/?>/i);
  if (brMatch) {
    return brMatch[0];
  }
  return null;
}

/**
 * Parse alignment from a delimiter cell (e.g., ":---:", "---:", ":---", "---")
 */
function parseAlignment(delimCell: string): Alignment {
  const trimmed = delimCell.trim();
  const hasLeft = trimmed.startsWith(":");
  const hasRight = trimmed.endsWith(":");

  if (hasLeft && hasRight) return "center";
  if (hasLeft) return "left";
  if (hasRight) return "right";
  return "none";
}

/**
 * Parse a table row into cells with position tracking
 * Returns array of cells with their content, padding, and positions
 */
function parseTableRow(
  rowText: string,
  rowStart: number,
  rowIndex: number
): CellData[] {
  const cells: CellData[] = [];

  // Split by | but handle escaped pipes
  // Simple approach: split by | and handle \| manually
  let currentPos = rowStart;
  let cellStart = 0;
  let cellContent = "";

  // Skip leading |
  let i = 0;
  while (i < rowText.length && rowText[i] !== "|") i++;
  if (rowText[i] === "|") {
    currentPos += i + 1;
    i++;
  }

  let colIndex = 0;
  cellStart = currentPos;
  cellContent = "";

  while (i < rowText.length) {
    const char = rowText[i];

    if (char === "\\" && i + 1 < rowText.length && rowText[i + 1] === "|") {
      // Escaped pipe - include both characters
      cellContent += "\\|";
      i += 2;
      currentPos += 2;
      continue;
    }

    if (char === "|") {
      // End of cell
      const { content, padLeft, padRight, contentFrom, contentTo } = parseCellContent(
        cellContent,
        cellStart
      );

      cells.push({
        content,
        from: contentFrom,
        to: contentTo,
        padLeft,
        padRight,
        brStyle: detectBrStyle(content),
        rowIndex,
        colIndex,
      });

      colIndex++;
      i++;
      currentPos++;
      cellStart = currentPos;
      cellContent = "";
      continue;
    }

    cellContent += char;
    i++;
    currentPos++;
  }

  // Handle any remaining content (shouldn't happen with proper table formatting)
  // but be defensive
  if (cellContent.trim()) {
    const { content, padLeft, padRight, contentFrom, contentTo } = parseCellContent(
      cellContent,
      cellStart
    );

    cells.push({
      content,
      from: contentFrom,
      to: contentTo,
      padLeft,
      padRight,
      brStyle: detectBrStyle(content),
      rowIndex,
      colIndex,
    });
  }

  return cells;
}

/**
 * Parse cell content to extract padding and actual content
 */
function parseCellContent(
  rawCell: string,
  cellStart: number
): {
  content: string;
  padLeft: string;
  padRight: string;
  contentFrom: number;
  contentTo: number;
} {
  // Find leading whitespace
  let padLeftLen = 0;
  while (padLeftLen < rawCell.length && rawCell[padLeftLen] === " ") {
    padLeftLen++;
  }

  // Find trailing whitespace
  let padRightLen = 0;
  let endIndex = rawCell.length - 1;
  while (endIndex >= padLeftLen && rawCell[endIndex] === " ") {
    padRightLen++;
    endIndex--;
  }

  const padLeft = rawCell.slice(0, padLeftLen);
  const padRight = rawCell.slice(rawCell.length - padRightLen);
  const content = rawCell.slice(padLeftLen, rawCell.length - padRightLen);

  return {
    content,
    padLeft,
    padRight,
    contentFrom: cellStart + padLeftLen,
    contentTo: cellStart + padLeftLen + content.length,
  };
}

/**
 * Check if a row is a delimiter row (contains only dashes, colons, spaces, and pipes)
 */
function isDelimiterRow(rowText: string): boolean {
  // Remove pipes and check if remaining is valid delimiter content
  const withoutPipes = rowText.replace(/\|/g, "");
  return /^[\s\-:]+$/.test(withoutPipes) && withoutPipes.includes("-");
}

/**
 * Parse delimiter row for alignment information
 */
function parseDelimiterRow(rowText: string): Alignment[] {
  const alignments: Alignment[] = [];

  // Split by | and parse each cell
  const parts = rowText.split("|").filter((p) => p.trim());

  for (const part of parts) {
    alignments.push(parseAlignment(part));
  }

  return alignments;
}

/**
 * Extract table data from an editor state using the Lezer syntax tree
 */
export function extractTableData(state: EditorState): TableData[] {
  const tables: TableData[] = [];
  const tree = syntaxTree(state);

  tree.iterate({
    enter(node) {
      if (node.name === "Table") {
        const tableFrom = node.from;
        const tableTo = node.to;
        const tableText = state.doc.sliceString(tableFrom, tableTo);

        // Split into lines
        const lines = tableText.split("\n");
        if (lines.length < 2) return; // Need at least header + delimiter

        // Find delimiter row (should be second line in GFM tables)
        let delimiterIndex = -1;
        for (let i = 0; i < lines.length; i++) {
          if (isDelimiterRow(lines[i])) {
            delimiterIndex = i;
            break;
          }
        }

        if (delimiterIndex === -1) return; // Invalid table without delimiter

        // Parse alignment from delimiter
        const alignment = parseDelimiterRow(lines[delimiterIndex]);

        // Calculate delimiter row position
        let delimiterFrom = tableFrom;
        for (let i = 0; i < delimiterIndex; i++) {
          delimiterFrom += lines[i].length + 1; // +1 for newline
        }
        const delimiterTo = delimiterFrom + lines[delimiterIndex].length;

        // Parse rows (excluding delimiter)
        const rows: CellData[][] = [];
        let lineStart = tableFrom;
        let dataRowIndex = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (i === delimiterIndex) {
            // Skip delimiter row in cell data
            lineStart += line.length + 1;
            continue;
          }

          const cells = parseTableRow(line, lineStart, dataRowIndex);
          if (cells.length > 0) {
            rows.push(cells);
            dataRowIndex++;
          }

          lineStart += line.length + (i < lines.length - 1 ? 1 : 0); // +1 for newline except last
        }

        tables.push({
          from: tableFrom,
          to: tableTo,
          rows,
          alignment,
          delimiterRow: lines[delimiterIndex],
          delimiterFrom,
          delimiterTo,
        });
      }
    },
  });

  return tables;
}

/**
 * Widget that renders an editable table
 */
class TableWidget extends WidgetType {
  // View reference will be captured in toDOM
  private viewRef: EditorView | null = null;

  constructor(readonly tableData: TableData) {
    super();
  }

  toDOM(view: EditorView): HTMLElement {
    // Capture view reference for event handlers
    this.viewRef = view;

    const wrapper = document.createElement("div");
    wrapper.className = "cm-table-widget";

    // Create table element
    const table = document.createElement("table");
    table.className = "cm-table";

    // Track all cells for Tab navigation
    const allCells: HTMLElement[] = [];

    // Render rows
    this.tableData.rows.forEach((row, rowIndex) => {
      const tr = document.createElement("tr");

      row.forEach((cell, colIndex) => {
        const isHeader = rowIndex === 0;
        const td = document.createElement(isHeader ? "th" : "td");
        td.className = "cm-table-cell";

        // Apply alignment
        const alignment = this.tableData.alignment[colIndex];
        if (alignment && alignment !== "none") {
          td.style.textAlign = alignment;
        }

        // Create editable content wrapper
        const contentWrapper = document.createElement("div");
        contentWrapper.className = "cm-table-cell-content";
        contentWrapper.contentEditable = "true";
        contentWrapper.spellcheck = false;

        // Set content (convert <br> to actual line breaks for display)
        contentWrapper.innerHTML = this.formatCellContent(cell.content);

        // Store cell reference for navigation
        allCells.push(contentWrapper);
        const cellIndex = allCells.length - 1;

        // Handle Tab/Shift+Tab navigation
        contentWrapper.addEventListener("keydown", (e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();

            // Commit current edit before moving
            this.commitCellEdit(contentWrapper, cell);

            // Navigate to next/prev cell
            const nextIndex = e.shiftKey ? cellIndex - 1 : cellIndex + 1;
            if (nextIndex >= 0 && nextIndex < allCells.length) {
              allCells[nextIndex].focus();
              // Select all content for easy replacement
              const selection = window.getSelection();
              const range = document.createRange();
              range.selectNodeContents(allCells[nextIndex]);
              selection?.removeAllRanges();
              selection?.addRange(range);
            }
          } else if (e.key === "Enter" && !e.shiftKey) {
            // Insert <br> on Enter (not submit)
            e.preventDefault();
            document.execCommand("insertHTML", false, "<br>");
          } else if (e.key === "Escape") {
            // Cancel edit and restore original
            contentWrapper.innerHTML = this.formatCellContent(cell.content);
            contentWrapper.blur();
          }
        });

        // Commit edits on blur
        contentWrapper.addEventListener("blur", () => {
          this.commitCellEdit(contentWrapper, cell);
        });

        td.appendChild(contentWrapper);
        tr.appendChild(td);
      });

      table.appendChild(tr);
    });

    wrapper.appendChild(table);

    // Add row/column buttons
    const controls = document.createElement("div");
    controls.className = "cm-table-controls";

    const addRowBtn = document.createElement("button");
    addRowBtn.type = "button";
    addRowBtn.className = "cm-table-add-row";
    addRowBtn.textContent = "+ Row";
    addRowBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.addRow();
    });

    const addColBtn = document.createElement("button");
    addColBtn.type = "button";
    addColBtn.className = "cm-table-add-column";
    addColBtn.textContent = "+ Column";
    addColBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.addColumn();
    });

    controls.appendChild(addRowBtn);
    controls.appendChild(addColBtn);
    wrapper.appendChild(controls);

    return wrapper;
  }

  /**
   * Format cell content for display (convert <br> to visible line breaks)
   */
  private formatCellContent(content: string): string {
    // Convert <br> variants to actual <br> for display
    return content.replace(/<br\s*\/?>/gi, "<br>");
  }

  /**
   * Get the <br> style used in the cell (or default)
   */
  private getBrStyle(cell: CellData): string {
    return cell.brStyle || "<br>";
  }

  /**
   * Commit cell edit to the document - only changes the specific cell range
   */
  private commitCellEdit(element: HTMLElement, cell: CellData): void {
    if (!this.viewRef) return;

    // Get current content from contenteditable
    let newContent = element.innerHTML;

    // Convert <br> back to the cell's preferred style
    const brStyle = this.getBrStyle(cell);
    newContent = newContent.replace(/<br\s*\/?>/gi, brStyle);

    // Convert &nbsp; back to space
    newContent = newContent.replace(/&nbsp;/g, " ");

    // Strip any other HTML tags (contenteditable might add them)
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = newContent;
    // Walk through and extract text, preserving <br>
    newContent = this.extractTextWithBr(tempDiv, brStyle);

    // Escape pipe characters in the new content
    const escapedContent = newContent.replace(/(?<!\\)\|/g, "\\|");

    // Only update if content actually changed
    if (escapedContent !== cell.content) {
      // Build the new cell value with preserved padding
      const newCellValue = cell.padLeft + escapedContent + cell.padRight;

      // Calculate what we're replacing (content with padding)
      const replaceFrom = cell.from - cell.padLeft.length;
      const replaceTo = cell.to + cell.padRight.length;

      // Dispatch minimal change to document
      this.viewRef.dispatch({
        changes: {
          from: replaceFrom,
          to: replaceTo,
          insert: newCellValue,
        },
      });
    }
  }

  /**
   * Extract text content preserving <br> tags
   */
  private extractTextWithBr(element: HTMLElement, brStyle: string): string {
    let result = "";

    element.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent || "";
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === "BR") {
          result += brStyle;
        } else {
          result += this.extractTextWithBr(el, brStyle);
        }
      }
    });

    return result;
  }

  /**
   * Add a new row to the table
   */
  private addRow(): void {
    if (!this.viewRef) return;

    const numCols = this.tableData.rows[0]?.length || 1;
    const newRowCells = Array(numCols).fill("|  ").join("") + "|";
    const newRowLine = "\n" + newRowCells;

    // Insert at end of table
    this.viewRef.dispatch({
      changes: {
        from: this.tableData.to,
        to: this.tableData.to,
        insert: newRowLine,
      },
    });
  }

  /**
   * Add a new column to the table
   */
  private addColumn(): void {
    if (!this.viewRef) return;

    // This is more complex - need to insert into each row
    // For now, rebuild the table with an extra column
    const doc = this.viewRef.state.doc.toString();
    const tableText = doc.slice(this.tableData.from, this.tableData.to);
    const lines = tableText.split("\n");

    const newLines = lines.map((line) => {
      if (line.endsWith("|")) {
        // Add new cell before final |
        if (isDelimiterRow(line)) {
          return line.slice(0, -1) + " --- |";
        } else {
          return line.slice(0, -1) + "  |";
        }
      }
      return line;
    });

    this.viewRef.dispatch({
      changes: {
        from: this.tableData.from,
        to: this.tableData.to,
        insert: newLines.join("\n"),
      },
    });
  }

  eq(other: TableWidget): boolean {
    // Compare table data for equality
    return (
      other.tableData.from === this.tableData.from &&
      other.tableData.to === this.tableData.to &&
      JSON.stringify(other.tableData.rows) === JSON.stringify(this.tableData.rows)
    );
  }

  destroy(): void {
    this.viewRef = null;
  }

  ignoreEvent(): boolean {
    // Allow events to propagate to contenteditable cells
    return false;
  }
}

/**
 * Build decorations for all tables in the document
 */
function buildTableDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tables = extractTableData(state);

  for (const table of tables) {
    const widget = Decoration.replace({
      widget: new TableWidget(table),
      block: true,
      inclusive: false,
    });

    builder.add(table.from, table.to, widget);
  }

  return builder.finish();
}

/**
 * StateField that tracks table decorations
 */
export const tableField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecorations(state);
  },

  update(value, tr) {
    if (tr.docChanged) {
      return buildTableDecorations(tr.state);
    }
    return value;
  },

  provide: (field) => [
    EditorView.decorations.from(field),
    EditorView.atomicRanges.of((view) => view.state.field(field)),
  ],
});
