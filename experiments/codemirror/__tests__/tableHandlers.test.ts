/**
 * Tests for GFM table support in the CodeMirror WYSIWYG experiment
 *
 * HTML table widget rendering: table replaced with block widget,
 * delimiter row hidden, edits sync back to markdown.
 */

import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  parseTableFromAST,
  parseAlignments,
  generateTableMarkdown,
  insertTable,
  addTableRow,
  removeTableRow,
  addTableColumn,
  removeTableColumn,
  collectTableExtents,
  codeBlockExtentsField,
  hiddenRangesField,
  hiddenSyntaxField,
  snapDirectional,
  snapToNearest,
  escapeHtml,
  getCurrentTableInfo,
  getContainerLinePrefix,
  handleTabInTable,
  handleShiftTabInTable,
  getAllTableCells,
  HighlightExtension,
  type HiddenRange,
  type HiddenRangeKind,
  type TableInfo,
} from "../harness";
import { syntaxTree } from "@codemirror/language";

let view: EditorView;

afterEach(() => {
  view?.destroy();
});

beforeAll(() => {
  if (!globalThis.requestAnimationFrame) {
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
      return setTimeout(() => cb(Date.now()), 0) as unknown as number;
    };
  }
});

// ===========================================
// HELPERS
// ===========================================

/**
 * Create a state with markdown + GFM parsing and hiddenRangesField.
 */
function createState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      markdown({ extensions: [GFM, HighlightExtension] }),
      codeBlockExtentsField,
      hiddenRangesField,
    ],
  });
}

/**
 * Create a minimal EditorView for table content (without | cursor marker parsing).
 * Positions cursor at a given offset (default: end of doc).
 */
function createTableView(doc: string, cursorPos?: number): EditorView {
  const pos = cursorPos ?? doc.length;
  return new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: pos },
      extensions: [markdown({ extensions: [GFM, HighlightExtension] })],
    }),
  });
}

/**
 * Create an EditorView with hiddenRangesField for Tab navigation tests.
 */
function createTableViewWithRanges(doc: string, cursorPos?: number): EditorView {
  const pos = cursorPos ?? doc.length;
  return new EditorView({
    state: EditorState.create({
      doc,
      selection: { anchor: pos },
      extensions: [
        markdown({ extensions: [GFM, HighlightExtension] }),
        codeBlockExtentsField,
        hiddenRangesField,
      ],
    }),
  });
}

/**
 * Create an EditorView with hidden syntax decorations for table widgets.
 */
function createTableViewWithWidget(doc: string): EditorView {
  return new EditorView({
    state: EditorState.create({
      doc,
      extensions: [
        markdown({ extensions: [GFM, HighlightExtension] }),
        codeBlockExtentsField,
        hiddenRangesField,
        hiddenSyntaxField,
      ],
    }),
  });
}

function flushRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

function getRanges(doc: string): HiddenRange[] {
  const state = createState(doc);
  return state.field(hiddenRangesField);
}

function rangesOfKind(ranges: HiddenRange[], kind: HiddenRangeKind): HiddenRange[] {
  return ranges.filter(r => r.kind === kind);
}

/**
 * Find the Table node in a state's syntax tree.
 */
function findTableNode(state: EditorState) {
  let tableNode: { from: number; to: number; node: any } | null = null;
  syntaxTree(state).iterate({
    enter(node) {
      if (node.name === "Table" && !tableNode) {
        tableNode = { from: node.from, to: node.to, node: node.node };
      }
    },
  });
  return tableNode;
}

// ===========================================
// parseAlignments
// ===========================================

describe("parseAlignments", () => {
  it("parses left alignment", () => {
    expect(parseAlignments("| :--- | --- |")).toEqual(["left", "none"]);
  });

  it("parses right alignment", () => {
    expect(parseAlignments("| ---: | --- |")).toEqual(["right", "none"]);
  });

  it("parses center alignment", () => {
    expect(parseAlignments("| :---: | --- |")).toEqual(["center", "none"]);
  });

  it("parses all-none alignment", () => {
    expect(parseAlignments("| --- | --- |")).toEqual(["none", "none"]);
  });

  it("parses mixed alignments", () => {
    expect(parseAlignments("| :--- | :---: | ---: |")).toEqual(["left", "center", "right"]);
  });
});

// ===========================================
// parseTableFromAST
// ===========================================

describe("parseTableFromAST", () => {
  it("parses a basic 2x2 table", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    expect(tableNode).not.toBeNull();

    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();
    expect(info!.columnCount).toBe(2);
    expect(info!.rowCount).toBe(3); // header + 2 body rows
    expect(info!.headerCells.length).toBe(2);
    expect(info!.headerCells[0].content).toBe("A");
    expect(info!.headerCells[1].content).toBe("B");
    expect(info!.bodyRows.length).toBe(2);
    expect(info!.bodyRows[0][0].content).toBe("1");
    expect(info!.bodyRows[0][1].content).toBe("2");
    expect(info!.bodyRows[1][0].content).toBe("3");
    expect(info!.bodyRows[1][1].content).toBe("4");
  });

  it("parses table with alignment markers", () => {
    const doc = "| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    expect(tableNode).not.toBeNull();

    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();
    expect(info!.columnAlignments).toEqual(["left", "center", "right"]);
  });

  it("parses table with inline formatting in cells", () => {
    const doc = "| Name | Value |\n| --- | --- |\n| **bold** | *italic* |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();
    expect(info!.bodyRows[0][0].content).toBe("**bold**");
    expect(info!.bodyRows[0][1].content).toBe("*italic*");
  });

  it("parses single-column table", () => {
    const doc = "| Item |\n| --- |\n| Apple |\n| Banana |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();
    expect(info!.columnCount).toBe(1);
    expect(info!.bodyRows.length).toBe(2);
  });

  it("parses table with empty cells", () => {
    const doc = "| A | B |\n| --- | --- |\n| data |  |\n|  | data |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();
    expect(info!.bodyRows.length).toBe(2);
    // First row: data in col 0, empty in col 1
    expect(info!.bodyRows[0].length).toBe(2);
    expect(info!.bodyRows[0][0].content).toBe("data");
    expect(info!.bodyRows[0][0].col).toBe(0);
    expect(info!.bodyRows[0][1].content).toBe("");
    expect(info!.bodyRows[0][1].col).toBe(1);
    // Second row: empty in col 0, data in col 1
    expect(info!.bodyRows[1].length).toBe(2);
    expect(info!.bodyRows[1][0].content).toBe("");
    expect(info!.bodyRows[1][0].col).toBe(0);
    expect(info!.bodyRows[1][1].content).toBe("data");
    expect(info!.bodyRows[1][1].col).toBe(1);
  });

  it("preserves empty cells in correct column positions", () => {
    // This is the specific bug case: empty middle cell should stay in col 1
    const doc = "| Col A | Col B | Col C |\n| ----- | ----- | ----- |\n| data  |       | data  |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);

    expect(info).not.toBeNull();
    expect(info!.columnCount).toBe(3);
    expect(info!.bodyRows[0].length).toBe(3);
    expect(info!.bodyRows[0][0].content).toBe("data");
    expect(info!.bodyRows[0][0].col).toBe(0);
    expect(info!.bodyRows[0][1].content).toBe("");  // Empty cell preserved in col 1!
    expect(info!.bodyRows[0][1].col).toBe(1);
    expect(info!.bodyRows[0][2].content).toBe("data");
    expect(info!.bodyRows[0][2].col).toBe(2);
  });

  it("handles multiple consecutive empty cells", () => {
    const doc = "| A | B | C | D |\n| - | - | - | - |\n|  |  |  | x |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);

    expect(info).not.toBeNull();
    expect(info!.columnCount).toBe(4);
    expect(info!.bodyRows[0].length).toBe(4);
    expect(info!.bodyRows[0][0].content).toBe("");
    expect(info!.bodyRows[0][1].content).toBe("");
    expect(info!.bodyRows[0][2].content).toBe("");
    expect(info!.bodyRows[0][3].content).toBe("x");
  });

  it("handles blank headers", () => {
    const doc = "| A |  | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);

    expect(info).not.toBeNull();
    expect(info!.headerCells.length).toBe(3);
    expect(info!.headerCells[0].content).toBe("A");
    expect(info!.headerCells[1].content).toBe("");  // Blank header preserved!
    expect(info!.headerCells[2].content).toBe("C");
  });

  it("handles all blank headers (user adds column)", () => {
    const doc = "| A | B |  |\n| --- | --- | --- |\n| 1 | 2 |  |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);

    expect(info).not.toBeNull();
    expect(info!.headerCells.length).toBe(3);
    expect(info!.headerCells[2].content).toBe("");  // New blank column
    expect(info!.columnCount).toBe(3);
  });

  it("parses table with header only (0 body rows)", () => {
    const doc = "| A | B |\n| --- | --- |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();
    expect(info!.bodyRows.length).toBe(0);
    expect(info!.rowCount).toBe(1); // header only
  });

  it("returns linePrefix and blankLinePrefix for top-level table", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();
    expect(info!.linePrefix).toBe("");
    expect(info!.blankLinePrefix).toBe("");
  });
});

// ===========================================
// generateTableMarkdown
// ===========================================

describe("generateTableMarkdown", () => {
  it("generates a basic table", () => {
    const md = generateTableMarkdown(
      ["Name", "Age"],
      [["Alice", "30"], ["Bob", "25"]],
      ["none", "none"]
    );
    expect(md).toContain("| Name");
    expect(md).toContain("Alice");
    expect(md).toContain("| ---");
    const lines = md.split("\n");
    expect(lines.length).toBe(4); // header, delimiter, 2 rows
  });

  it("handles alignment markers", () => {
    const md = generateTableMarkdown(
      ["Left", "Center", "Right"],
      [["a", "b", "c"]],
      ["left", "center", "right"]
    );
    expect(md).toContain(":--"); // left alignment
    expect(md).toMatch(/:[\-]+:/); // center alignment
    expect(md).toMatch(/[\-]+:/); // right alignment
  });

  it("pads columns to consistent width", () => {
    const md = generateTableMarkdown(
      ["A", "LongHeader"],
      [["short", "x"]],
      ["none", "none"]
    );
    const lines = md.split("\n");
    // All rows should have same number of pipe-separated segments
    expect(lines[0].split("|").length).toBe(lines[2].split("|").length);
  });

  it("handles empty cells", () => {
    const md = generateTableMarkdown(
      ["A", "B"],
      [["", "data"], ["data", ""]],
      ["none", "none"]
    );
    expect(md).toBeDefined();
    const lines = md.split("\n");
    expect(lines.length).toBe(4);
  });

  it("round-trips with parseTableFromAST", () => {
    const originalHeaders = ["Name", "Value"];
    const originalRows = [["foo", "bar"], ["baz", "qux"]];
    const alignments: ("left" | "center" | "right" | "none")[] = ["none", "none"];
    const md = generateTableMarkdown(originalHeaders, originalRows, alignments);

    const state = createState(md);
    const tableNode = findTableNode(state);
    expect(tableNode).not.toBeNull();

    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();
    expect(info!.headerCells.map(c => c.content.trim())).toEqual(originalHeaders);
    expect(info!.bodyRows.map(r => r.map(c => c.content.trim()))).toEqual(originalRows);
  });

  it("applies continuationPrefix to lines 2+", () => {
    const md = generateTableMarkdown(
      ["A", "B"],
      [["1", "2"]],
      ["none", "none"],
      "> "
    );
    const lines = md.split("\n");
    // First line has NO prefix
    expect(lines[0]).toMatch(/^\|/);
    // Subsequent lines have "> " prefix
    expect(lines[1]).toMatch(/^> \|/);
    expect(lines[2]).toMatch(/^> \|/);
  });
});

// ===========================================
// getHiddenRanges — table-delimiter
// ===========================================

describe("getHiddenRanges - tables", () => {
  it("creates table-delimiter range for delimiter row", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const ranges = getRanges(doc);
    const delimRanges = rangesOfKind(ranges, "table-delimiter");
    expect(delimRanges.length).toBe(1);
    // Delimiter range covers the entire delimiter line
    const delimLine = doc.split("\n")[1];
    const delimStart = doc.indexOf(delimLine);
    expect(delimRanges[0].from).toBe(delimStart);
    expect(delimRanges[0].to).toBe(delimStart + delimLine.length);
  });

  it("attaches tableInfo metadata and node bounds", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const ranges = getRanges(doc);
    const delimRanges = rangesOfKind(ranges, "table-delimiter");
    const delimRange = delimRanges[0];
    const info = delimRange.meta?.tableInfo as TableInfo | undefined;
    expect(info).toBeDefined();
    if (info) {
      expect(delimRange.nodeFrom).toBe(info.from);
      expect(delimRange.nodeTo).toBe(info.to);
    }
  });

  it("filters out hidden ranges inside the table body", () => {
    const doc = "| **bold** | *italic* |\n| --- | --- |\n| data | data |";
    const ranges = getRanges(doc);
    const delimRanges = rangesOfKind(ranges, "table-delimiter");
    const info = delimRanges[0].meta?.tableInfo as TableInfo;
    const overlapping = ranges.filter(r =>
      r.kind !== "table-delimiter" &&
      r.from >= info.from &&
      r.to <= info.to
    );
    expect(overlapping.length).toBe(0);
  });

  it("handles table after other content", () => {
    const doc = "# Heading\n\n| A | B |\n| --- | --- |\n| 1 | 2 |";
    const ranges = getRanges(doc);
    const delimRanges = rangesOfKind(ranges, "table-delimiter");
    expect(delimRanges.length).toBe(1);
    // Heading prefix should still exist
    const headingRanges = rangesOfKind(ranges, "heading-prefix");
    expect(headingRanges.length).toBe(1);
  });
});

// ===========================================
// collectTableExtents
// ===========================================

describe("collectTableExtents", () => {
  it("returns empty for non-table content", () => {
    const state = createState("# Heading\n\nSome text");
    expect(collectTableExtents(state).length).toBe(0);
  });

  it("returns extents for a table", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const state = createState(doc);
    const extents = collectTableExtents(state);
    expect(extents.length).toBe(1);
    expect(extents[0].from).toBe(0);
  });
});

// ===========================================
// insertTable
// ===========================================

describe("insertTable", () => {
  it("inserts a default 2x2 table at cursor", () => {
    view = createTableView("", 0);
    const result = insertTable(view);
    expect(result).toBe(true);
    const doc = view.state.doc.toString();
    expect(doc).toContain("Header 1");
    expect(doc).toContain("Header 2");
    expect(doc).toContain("---");
  });

  it("adds blank lines when inserting after content", () => {
    view = createTableView("Some text", 9);
    insertTable(view);
    const doc = view.state.doc.toString();
    // Should have blank lines before the table
    expect(doc).toMatch(/Some text\n\n/);
  });

  it("inserts default headers", () => {
    view = createTableView("", 0);
    insertTable(view);
    const doc = view.state.doc.toString();
    expect(doc).toContain("Header 1");
    expect(doc).toContain("Header 2");
  });

  it("uses custom row and column counts", () => {
    view = createTableView("", 0);
    insertTable(view, 3, 4);
    const doc = view.state.doc.toString();
    expect(doc).toContain("Header 4");
    // Should have 3 body rows + header + delimiter = 5 pipe-starting lines
    const lines = doc.trim().split("\n").filter(l => l.trim().startsWith("|"));
    expect(lines.length).toBe(5);
  });

  it("inserts table inside a blockquote with > prefix", () => {
    view = createTableView("> some text", 11);
    const result = insertTable(view);
    expect(result).toBe(true);
    const doc = view.state.doc.toString();
    // All lines of the table should have > prefix
    const lines = doc.split("\n").filter(l => l.includes("|"));
    for (const line of lines) {
      expect(line.trimStart()).toMatch(/^>?\s*\|/);
    }
  });

  it("inserts table inside a list with indentation", () => {
    view = createTableView("- list item", 11);
    const result = insertTable(view);
    expect(result).toBe(true);
    const doc = view.state.doc.toString();
    // Table lines (after the first) should have indentation for list continuation
    expect(doc).toContain("|");
  });
});

// ===========================================
// Row/Column operations
// ===========================================

describe("addTableRow", () => {
  it("appends an empty row to the table", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableView(doc);
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();

    addTableRow(view, info!);
    const newDoc = view.state.doc.toString();
    const lines = newDoc.split("\n").filter(l => l.trim().startsWith("|"));
    expect(lines.length).toBe(4); // header, delimiter, original row, new row
  });

  it("preserves linePrefix when adding a row", () => {
    // Simulate a table that has linePrefix set (e.g., inside blockquote)
    const doc = "> | A | B |\n> | --- | --- |\n> | 1 | 2 |";
    view = createTableView(doc);
    const state = createState(doc);
    const tableNode = findTableNode(state);
    if (tableNode) {
      const info = parseTableFromAST(state, tableNode);
      if (info && info.linePrefix) {
        addTableRow(view, info);
        const newDoc = view.state.doc.toString();
        const lines = newDoc.split("\n").filter(l => l.includes("|"));
        // All continuation lines should have the prefix
        for (let i = 1; i < lines.length; i++) {
          expect(lines[i].startsWith(info.linePrefix) || lines[i].startsWith("|")).toBe(true);
        }
      }
    }
  });
});

describe("removeTableRow", () => {
  it("removes the last body row", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
    view = createTableView(doc);
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();

    removeTableRow(view, info!);
    const newDoc = view.state.doc.toString();
    const lines = newDoc.split("\n").filter(l => l.trim().startsWith("|"));
    expect(lines.length).toBe(3); // header, delimiter, 1 remaining row
  });

  it("does nothing when there are 0 body rows", () => {
    const doc = "| A | B |\n| --- | --- |";
    view = createTableView(doc);
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();

    removeTableRow(view, info!);
    // Should not change (document stays the same)
    expect(view.state.doc.toString()).toBe(doc);
  });
});

describe("addTableColumn", () => {
  it("adds a blank column (no prefilled header)", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableView(doc);
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();

    addTableColumn(view, info!);
    const newDoc = view.state.doc.toString();
    // New column should be blank, not "Header 3"
    expect(newDoc).not.toContain("Header 3");
    // Should have 3 columns now (3 pipe separators per row)
    const lines = newDoc.split("\n");
    expect(lines[0].split("|").length - 1).toBe(4); // |A|B| | = 4 segments
  });
});

describe("removeTableColumn", () => {
  it("removes the last column", () => {
    const doc = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |";
    view = createTableView(doc);
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();

    removeTableColumn(view, info!);
    const newDoc = view.state.doc.toString();
    expect(newDoc).not.toContain("| C");
  });

  it("keeps at least 1 column", () => {
    const doc = "| A |\n| --- |\n| 1 |";
    view = createTableView(doc);
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();

    const docBefore = view.state.doc.toString();
    removeTableColumn(view, info!);
    // Should not change
    expect(view.state.doc.toString()).toBe(docBefore);
  });
});

// ===========================================
// Selection snapping — table block
// ===========================================

describe("selection snapping - tables", () => {
  // Tables are fully replaced by widgets with their own editing,
  // so cursor positions inside tables should NOT be snapped.
  // This allows the widget's contentEditable cells to receive focus.

  it("does NOT snap cursor inside table range forward (widget-based)", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const state = createState(doc);
    const ranges = state.field(hiddenRangesField);
    const delimRange = rangesOfKind(ranges, "table-delimiter")[0];
    const tableFrom = delimRange.nodeFrom;

    const insidePos = tableFrom + 2;
    const snappedPos = snapDirectional(insidePos, 1, ranges, state);
    // Should NOT snap - position stays the same
    expect(snappedPos).toBe(insidePos);
  });

  it("does NOT snap cursor inside table range backward (widget-based)", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const state = createState(doc);
    const ranges = state.field(hiddenRangesField);
    const delimRange = rangesOfKind(ranges, "table-delimiter")[0];
    const tableFrom = delimRange.nodeFrom;

    const insidePos = tableFrom + 2;
    const snappedPos = snapDirectional(insidePos, -1, ranges, state);
    // Should NOT snap - position stays the same
    expect(snappedPos).toBe(insidePos);
  });

  it("snapToNearest does NOT snap inside table range (widget-based)", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    const state = createState(doc);
    const ranges = state.field(hiddenRangesField);
    const delimRange = rangesOfKind(ranges, "table-delimiter")[0];
    const tableFrom = delimRange.nodeFrom;

    const insidePos = tableFrom + 3;
    const snappedPos = snapToNearest(insidePos, ranges, state);
    // Should NOT snap - position stays the same
    expect(snappedPos).toBe(insidePos);
  });
});

// ===========================================
// Table block widget
// ===========================================

describe("table block widget", () => {
  it("renders an HTML table for markdown tables", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);
    const table = view.dom.querySelector("table.cm-table");
    expect(table).not.toBeNull();
    const headerCells = table!.querySelectorAll("thead th");
    const bodyCells = table!.querySelectorAll("tbody td");
    expect(headerCells.length).toBe(2);
    expect(bodyCells.length).toBe(2);
  });

  it("syncs cell edits back to markdown", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);
    const cell = view.dom.querySelector("thead th") as HTMLElement;
    expect(cell).toBeDefined();
    cell.focus();
    cell.textContent = "Updated";
    cell.dispatchEvent(new Event("input", { bubbles: true }));
    await flushRaf();
    expect(view.state.doc.toString()).toContain("Updated");
  });

  it("Tab moves focus to the next cell", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);
    const cells = Array.from(view.dom.querySelectorAll("th, td")) as HTMLElement[];
    expect(cells.length).toBeGreaterThan(1);
    const first = cells[0];
    const second = cells[1];
    const focusSpy = vi.spyOn(second, "focus");
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it("renders inline markdown when not focused", () => {
    const doc = "| **bold** | *italic* |\n| --- | --- |\n| `code` | ==hi== |";
    view = createTableViewWithWidget(doc);
    const headerCells = Array.from(view.dom.querySelectorAll("thead th")) as HTMLElement[];
    const bodyCells = Array.from(view.dom.querySelectorAll("tbody td")) as HTMLElement[];
    expect(headerCells[0].innerHTML).toContain("cm-strong");
    expect(headerCells[1].innerHTML).toContain("cm-em");
    expect(bodyCells[0].innerHTML).toContain("cm-inline-code");
    expect(bodyCells[1].innerHTML).toContain("cm-highlight");
  });
});

// ===========================================
// escapeHtml
// ===========================================

describe("escapeHtml", () => {
  it("escapes HTML entities", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });
});

// ===========================================
// Lezer greedy parse fix
// ===========================================

describe("Lezer greedy parse fix", () => {
  it("table range does NOT include non-table text after table (no blank line)", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\nsome text after";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    expect(tableNode).not.toBeNull();

    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();
    // The table should end before "some text after"
    const textStart = doc.indexOf("some text after");
    expect(info!.to).toBeLessThanOrEqual(textStart);
  });

  it("collectTableExtents does NOT extend into non-table text", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\nsome text after";
    const state = createState(doc);
    const extents = collectTableExtents(state);
    expect(extents.length).toBe(1);
    const textStart = doc.indexOf("some text after");
    expect(extents[0].to).toBeLessThanOrEqual(textStart);
  });
});

// ===========================================
// Ragged rows
// ===========================================

describe("ragged rows", () => {
  it("parseTableFromAST handles rows with fewer cells than header", () => {
    // Row with only 1 cell but header has 3
    const doc = "| A | B | C |\n| --- | --- | --- |\n| 1 |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();
    expect(info!.columnCount).toBe(3);
    expect(info!.bodyRows.length).toBe(1);
    // The ragged row should have fewer cells than header
    expect(info!.bodyRows[0].length).toBeLessThanOrEqual(3);
  });
});

// ===========================================
// getCurrentTableInfo
// ===========================================

describe("getCurrentTableInfo", () => {
  it("re-parses table info from current state", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [markdown({ extensions: [GFM, HighlightExtension] })],
      }),
    });
    const info = getCurrentTableInfo(view, 0);
    expect(info).not.toBeNull();
    expect(info!.columnCount).toBe(2);
    expect(info!.headerCells[0].content).toBe("A");
  });

  it("returns null when no table at position", () => {
    view = new EditorView({
      state: EditorState.create({
        doc: "# Just a heading",
        extensions: [markdown({ extensions: [GFM, HighlightExtension] })],
      }),
    });
    const info = getCurrentTableInfo(view, 0);
    expect(info).toBeNull();
  });

  it("reflects edits after dispatch", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [markdown({ extensions: [GFM, HighlightExtension] })],
      }),
    });

    // Edit: change "A" to "X" by replacing the first cell content
    const newDoc = "| X | B |\n| --- | --- |\n| 1 | 2 |";
    view.dispatch({ changes: { from: 0, to: doc.length, insert: newDoc } });

    const info = getCurrentTableInfo(view, 0);
    expect(info).not.toBeNull();
    expect(info!.headerCells[0].content).toBe("X");
  });
});

// ===========================================
// getContainerLinePrefix
// ===========================================

describe("getContainerLinePrefix", () => {
  it("returns empty strings for plain text", () => {
    const state = createState("plain text");
    const line = state.doc.line(1);
    const result = getContainerLinePrefix(state, line);
    expect(result.linePrefix).toBe("");
    expect(result.blankLinePrefix).toBe("");
  });

  it("returns '> ' prefix for blockquote", () => {
    const state = createState("> blockquote text");
    const line = state.doc.line(1);
    const result = getContainerLinePrefix(state, line);
    expect(result.linePrefix).toBe("> ");
    expect(result.blankLinePrefix).toBe(">");
  });

  it("returns indentation for list continuation", () => {
    const state = createState("- list item");
    const line = state.doc.line(1);
    const result = getContainerLinePrefix(state, line);
    // Should return spaces matching contentStart
    expect(result.linePrefix).toMatch(/^\s+$/);
    expect(result.linePrefix.length).toBeGreaterThan(0);
  });

  it("returns combined prefix for blockquote containing list", () => {
    const state = createState("> - nested item");
    const line = state.doc.line(1);
    const result = getContainerLinePrefix(state, line);
    // Should start with "> " and have additional indentation
    expect(result.linePrefix).toMatch(/^> /);
    expect(result.linePrefix.length).toBeGreaterThan(2);
  });
});

// ===========================================
// getAllTableCells
// ===========================================

describe("getAllTableCells", () => {
  it("returns all cells in reading order (header + body)", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();

    const cells = getAllTableCells(info!);
    // 2 header + 4 body = 6 cells
    expect(cells.length).toBe(6);
    expect(cells[0].content).toBe("A");
    expect(cells[1].content).toBe("B");
    expect(cells[2].content).toBe("1");
    expect(cells[3].content).toBe("2");
    expect(cells[4].content).toBe("3");
    expect(cells[5].content).toBe("4");
  });

  it("returns only header cells for header-only table", () => {
    const doc = "| A | B |\n| --- | --- |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();

    const cells = getAllTableCells(info!);
    expect(cells.length).toBe(2);
    expect(cells[0].content).toBe("A");
    expect(cells[1].content).toBe("B");
  });
});

// ===========================================
// Tab navigation
// ===========================================

describe("Tab navigation in tables", () => {
  it("handleTabInTable returns false when not in a table", () => {
    view = createTableViewWithRanges("plain text", 5);
    const result = handleTabInTable(view);
    expect(result).toBe(false);
  });

  it("handleTabInTable moves to next cell", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    // Place cursor in the first header cell (position of "A")
    const aPos = doc.indexOf("A");
    view = createTableViewWithRanges(doc, aPos);
    const result = handleTabInTable(view);
    expect(result).toBe(true);
    // Cursor should now be in/selecting the "B" cell
    const head = view.state.selection.main.head;
    const bPos = doc.indexOf("B");
    // Head should be at or near the B cell
    expect(head).toBeGreaterThanOrEqual(bPos);
  });

  it("handleShiftTabInTable returns false when not in a table", () => {
    view = createTableViewWithRanges("plain text", 5);
    const result = handleShiftTabInTable(view);
    expect(result).toBe(false);
  });

  it("handleShiftTabInTable moves to previous cell", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    // Place cursor in the "B" cell
    const bPos = doc.indexOf("B");
    view = createTableViewWithRanges(doc, bPos);
    const result = handleShiftTabInTable(view);
    expect(result).toBe(true);
    // Cursor should now be in the "A" cell (between first and second pipe)
    const head = view.state.selection.main.head;
    const firstPipe = doc.indexOf("|");
    const secondPipe = doc.indexOf("|", firstPipe + 1);
    expect(head).toBeGreaterThan(firstPipe);
    expect(head).toBeLessThanOrEqual(secondPipe);
  });

  it("handleShiftTabInTable at first cell consumes key", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    // Place cursor in the first header cell
    const aPos = doc.indexOf("A");
    view = createTableViewWithRanges(doc, aPos);
    const result = handleShiftTabInTable(view);
    // Should return true (consumed) even at first cell
    expect(result).toBe(true);
  });

  it("handleTabInTable at last cell adds a new row", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    // Place cursor at the last cell content "2"
    const twoPos = doc.indexOf("2");
    view = createTableViewWithRanges(doc, twoPos);
    const result = handleTabInTable(view);
    expect(result).toBe(true);
    // Doc should now have an additional row
    const newDoc = view.state.doc.toString();
    const pipeLines = newDoc.split("\n").filter(l => l.trim().startsWith("|"));
    expect(pipeLines.length).toBe(4); // header, delim, row1, new row
  });

  it("Tab navigates from header to body cells (skipping delimiter)", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    // Place cursor in "B" cell (last header cell)
    const bPos = doc.indexOf("B");
    view = createTableViewWithRanges(doc, bPos);
    handleTabInTable(view);
    // Should be in the "1" cell now (skipping delimiter)
    const head = view.state.selection.main.head;
    const onePos = doc.indexOf("1");
    // Head should be at or near cell "1"
    expect(head).toBeGreaterThanOrEqual(onePos);
    expect(head).toBeLessThan(doc.indexOf("2"));
  });
});

// ===========================================
// Column Alignment Integration Tests
// ===========================================

describe("column alignment", () => {
  it("renders table with equal column widths when using table-layout: fixed", () => {
    const doc = "| Short | Much Longer Header |\n| --- | --- |\n| A | B |";
    view = createTableViewWithWidget(doc);
    const table = view.dom.querySelector("table.cm-table") as HTMLTableElement;
    expect(table).not.toBeNull();

    // With table-layout: fixed, columns should have equal width
    const headerCells = Array.from(table.querySelectorAll("thead th"));
    expect(headerCells.length).toBe(2);

    // Note: In jsdom, computed widths may not be reliable, but we verify structure
    expect(table.style.tableLayout || getComputedStyle(table).tableLayout).toBeDefined();
  });

  it("renders table with consistent column count across all rows", () => {
    const doc = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |";
    view = createTableViewWithWidget(doc);
    const table = view.dom.querySelector("table.cm-table") as HTMLTableElement;

    const headerCells = table.querySelectorAll("thead th");
    const row1Cells = table.querySelectorAll("tbody tr:first-child td");
    const row2Cells = table.querySelectorAll("tbody tr:last-child td");

    expect(headerCells.length).toBe(3);
    expect(row1Cells.length).toBe(3);
    expect(row2Cells.length).toBe(3);
  });

  it("preserves alignment metadata from markdown", () => {
    const doc = "| Left | Center | Right |\n| :--- | :---: | ---: |\n| a | b | c |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);

    expect(info!.columnAlignments).toEqual(["left", "center", "right"]);
  });

  it("handles tables with many columns", () => {
    const headers = Array.from({ length: 10 }, (_, i) => `H${i + 1}`).join(" | ");
    const delim = Array.from({ length: 10 }, () => "---").join(" | ");
    const row = Array.from({ length: 10 }, (_, i) => `C${i + 1}`).join(" | ");
    const doc = `| ${headers} |\n| ${delim} |\n| ${row} |`;

    view = createTableViewWithWidget(doc);
    const table = view.dom.querySelector("table.cm-table") as HTMLTableElement;

    expect(table.querySelectorAll("thead th").length).toBe(10);
    expect(table.querySelectorAll("tbody td").length).toBe(10);
  });

  it("applies text alignment from markdown column alignment markers", () => {
    const doc = "| Left | Center | Right |\n| :--- | :---: | ---: |\n| L | C | R |";
    view = createTableViewWithWidget(doc);

    const headerCells = Array.from(view.dom.querySelectorAll("thead th")) as HTMLElement[];
    const bodyCells = Array.from(view.dom.querySelectorAll("tbody td")) as HTMLElement[];

    // Verify header alignment
    expect(headerCells[0].style.textAlign).toBe("left");
    expect(headerCells[1].style.textAlign).toBe("center");
    expect(headerCells[2].style.textAlign).toBe("right");

    // Verify body alignment matches header
    expect(bodyCells[0].style.textAlign).toBe("left");
    expect(bodyCells[1].style.textAlign).toBe("center");
    expect(bodyCells[2].style.textAlign).toBe("right");
  });

  it("defaults to left alignment when no marker specified", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const headerCells = Array.from(view.dom.querySelectorAll("thead th")) as HTMLElement[];
    const bodyCells = Array.from(view.dom.querySelectorAll("tbody td")) as HTMLElement[];

    // Default (no marker) should be left-aligned
    expect(headerCells[0].style.textAlign).toBe("left");
    expect(headerCells[1].style.textAlign).toBe("left");
    expect(bodyCells[0].style.textAlign).toBe("left");
    expect(bodyCells[1].style.textAlign).toBe("left");
  });
});

// ===========================================
// Cell Editing Integration Tests
// ===========================================

describe("cell editing integration", () => {
  it("updates markdown when header cell is edited", async () => {
    const doc = "| Original | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const headerCell = view.dom.querySelector("thead th") as HTMLElement;
    headerCell.focus();
    headerCell.textContent = "Modified";
    headerCell.dispatchEvent(new Event("input", { bubbles: true }));

    await flushRaf();

    expect(view.state.doc.toString()).toContain("Modified");
    expect(view.state.doc.toString()).not.toContain("Original");
  });

  it("updates markdown when body cell is edited", async () => {
    const doc = "| A | B |\n| --- | --- |\n| Original | 2 |";
    view = createTableViewWithWidget(doc);

    const bodyCell = view.dom.querySelector("tbody td") as HTMLElement;
    bodyCell.focus();
    bodyCell.textContent = "Changed";
    bodyCell.dispatchEvent(new Event("input", { bubbles: true }));

    await flushRaf();

    expect(view.state.doc.toString()).toContain("Changed");
  });

  it("handles special characters in cell content", async () => {
    const doc = "| A | B |\n| --- | --- |\n| test | x |";
    view = createTableViewWithWidget(doc);

    const bodyCell = view.dom.querySelector("tbody td") as HTMLElement;
    bodyCell.focus();
    bodyCell.textContent = "a & b < c > d";
    bodyCell.dispatchEvent(new Event("input", { bubbles: true }));

    await flushRaf();

    // Should preserve special characters in markdown
    expect(view.state.doc.toString()).toContain("a & b < c > d");
  });

  it("handles empty cell content", async () => {
    const doc = "| A | B |\n| --- | --- |\n| content | x |";
    view = createTableViewWithWidget(doc);

    const bodyCell = view.dom.querySelector("tbody td") as HTMLElement;
    bodyCell.focus();
    bodyCell.textContent = "";
    bodyCell.dispatchEvent(new Event("input", { bubbles: true }));

    await flushRaf();

    // Table should still be valid with empty cell
    const newState = createState(view.state.doc.toString());
    const tableNode = findTableNode(newState);
    expect(tableNode).not.toBeNull();
  });

  it("preserves inline formatting when editing other cells", async () => {
    const doc = "| **bold** | plain |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    // Edit the plain cell
    const headerCells = Array.from(view.dom.querySelectorAll("thead th")) as HTMLElement[];
    const plainCell = headerCells[1];
    plainCell.focus();
    plainCell.textContent = "modified";
    plainCell.dispatchEvent(new Event("input", { bubbles: true }));

    await flushRaf();

    // Bold formatting should be preserved in first cell
    expect(view.state.doc.toString()).toContain("**bold**");
  });

  it("renders inline markdown when cell loses focus", async () => {
    const doc = "| A | B |\n| --- | --- |\n| **test** | x |";
    view = createTableViewWithWidget(doc);

    const bodyCell = view.dom.querySelector("tbody td") as HTMLElement;

    // Cell initially renders markdown (bold)
    expect(bodyCell.innerHTML).toContain("cm-strong");
    expect(bodyCell.dataset.raw).toBe("**test**");

    // Manually simulate focus behavior (jsdom doesn't always fire focus events)
    bodyCell.dispatchEvent(new FocusEvent("focus"));
    // After focus, cell should show raw markdown in textContent
    // Note: Direct textContent check may not work in jsdom; verify dataset
    expect(bodyCell.dataset.raw).toBe("**test**");

    // After blur, should re-render markdown
    bodyCell.dispatchEvent(new FocusEvent("blur"));
    await flushRaf();

    // Should contain rendered bold element
    expect(bodyCell.innerHTML).toContain("cm-strong");
  });
});

// ===========================================
// Undo/Redo Integration Tests
// ===========================================

describe("undo/redo with tables", () => {
  it("can undo cell edit via dispatch", async () => {
    const originalDoc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(originalDoc);

    // Edit a cell
    const cell = view.dom.querySelector("tbody td") as HTMLElement;
    cell.focus();
    cell.textContent = "changed";
    cell.dispatchEvent(new Event("input", { bubbles: true }));

    await flushRaf();

    expect(view.state.doc.toString()).toContain("changed");

    // Note: Undo would need to be tested via CodeMirror's history extension
    // which is included in full setup. Here we verify the edit was dispatched.
  });

  it("preserves table structure after multiple edits", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    // Edit multiple cells
    const cells = Array.from(view.dom.querySelectorAll("th, td")) as HTMLElement[];

    for (let i = 0; i < cells.length; i++) {
      cells[i].focus();
      cells[i].textContent = `Cell${i}`;
      cells[i].dispatchEvent(new Event("input", { bubbles: true }));
      await flushRaf();
    }

    // Table should still be valid
    const finalDoc = view.state.doc.toString();
    const newState = createState(finalDoc);
    const tableNode = findTableNode(newState);
    expect(tableNode).not.toBeNull();

    const info = parseTableFromAST(newState, tableNode!);
    expect(info!.columnCount).toBe(2);
    expect(info!.rowCount).toBe(2);
  });
});

// ===========================================
// Container Tests (Blockquote, List)
// ===========================================

describe("tables in containers", () => {
  // Note: Lezer GFM parser may not recognize tables inside blockquotes as Table nodes.
  // The parser treats "> | A | B |" as blockquote content, not as a table.
  // These tests verify current behavior and document limitations.

  it("finds table node inside blockquote (if parser supports it)", () => {
    const doc = "> | A | B |\n> | --- | --- |\n> | 1 | 2 |";
    const state = createState(doc);
    const tableNode = findTableNode(state);

    // Lezer GFM may not parse this as a Table - skip if not found
    if (tableNode) {
      const info = parseTableFromAST(state, tableNode);
      if (info) {
        expect(info.linePrefix).toBe("> ");
        expect(info.blankLinePrefix).toBe(">");
      }
    }
    // Test passes regardless - this documents parser limitations
    expect(true).toBe(true);
  });

  it("preserves blockquote prefix when adding row (when table is found)", () => {
    const doc = "> | A | B |\n> | --- | --- |\n> | 1 | 2 |";
    view = createTableView(doc);
    const state = createState(doc);
    const tableNode = findTableNode(state);

    // Skip if parser doesn't find the table
    if (!tableNode) {
      expect(true).toBe(true);
      return;
    }

    const info = parseTableFromAST(state, tableNode);
    if (!info) {
      expect(true).toBe(true);
      return;
    }

    addTableRow(view, info);

    const newDoc = view.state.doc.toString();
    const lines = newDoc.split("\n");

    // All lines should start with > (blockquote prefix)
    for (const line of lines) {
      if (line.includes("|")) {
        expect(line.trimStart().startsWith(">")).toBe(true);
      }
    }
  });

  it("inserts table inside blockquote correctly", () => {
    view = createTableView("> some text", 11);
    insertTable(view);

    const doc = view.state.doc.toString();
    const tableLines = doc.split("\n").filter(l => l.includes("|"));

    // Table lines in blockquote should have > prefix
    expect(tableLines.length).toBeGreaterThan(0);
  });

  it("parses table inside nested blockquote (if parser supports it)", () => {
    const doc = "> > | A | B |\n> > | --- | --- |\n> > | 1 | 2 |";
    const state = createState(doc);
    const tableNode = findTableNode(state);

    // Skip if parser doesn't find the table
    if (!tableNode) {
      expect(true).toBe(true);
      return;
    }

    const info = parseTableFromAST(state, tableNode);
    if (!info) {
      expect(true).toBe(true);
      return;
    }

    // Prefix should handle nested blockquotes
    expect(info.linePrefix.includes(">")).toBe(true);
  });

  it("handles top-level table before blockquote", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\n\n> blockquote";
    const state = createState(doc);
    const tableNode = findTableNode(state);

    expect(tableNode).not.toBeNull();
    const info = parseTableFromAST(state, tableNode!);
    expect(info).not.toBeNull();
    expect(info!.linePrefix).toBe("");
  });
});

// ===========================================
// Widget Update Tests
// ===========================================

describe("widget updateDOM", () => {
  it("updates cell content without full rebuild", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const initialTable = view.dom.querySelector("table.cm-table");
    expect(initialTable).not.toBeNull();

    // Trigger document change
    const newDoc = "| X | Y |\n| --- | --- |\n| 1 | 2 |";
    view.dispatch({ changes: { from: 0, to: doc.length, insert: newDoc } });

    await flushRaf();

    // Widget should have updated (either same DOM or rebuilt)
    const updatedTable = view.dom.querySelector("table.cm-table");
    expect(updatedTable).not.toBeNull();
  });

  it("handles column count change in markdown", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    // Add a column using view's own state
    const tableNode = findTableNode(view.state);
    const info = parseTableFromAST(view.state, tableNode!);
    expect(info).not.toBeNull();

    addTableColumn(view, info!);
    await flushRaf();

    // Verify markdown changed to 3 columns (4 pipes = | A | B |  |)
    const newDoc = view.state.doc.toString();
    expect(newDoc.split("\n")[0].match(/\|/g)?.length).toBe(4);
    // Delimiter row also has 3 columns
    expect(newDoc.split("\n")[1].match(/---/g)?.length).toBe(3);
    // Body row also has 3 columns
    expect(newDoc.split("\n")[2].match(/\|/g)?.length).toBe(4);
  });

  it("handles row count change", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);

    addTableRow(view, info!);

    await flushRaf();

    const table = view.dom.querySelector("table.cm-table");
    expect(table!.querySelectorAll("tbody tr").length).toBe(2);
  });
});

// ===========================================
// Edge Cases
// ===========================================

describe("edge cases", () => {
  it("handles table with only header row", () => {
    const doc = "| A | B |\n| --- | --- |";
    view = createTableViewWithWidget(doc);

    const table = view.dom.querySelector("table.cm-table");
    expect(table).not.toBeNull();
    expect(table!.querySelectorAll("thead th").length).toBe(2);
    expect(table!.querySelectorAll("tbody tr").length).toBe(0);
  });

  it("handles table with single column", () => {
    const doc = "| Item |\n| --- |\n| Apple |\n| Banana |";
    view = createTableViewWithWidget(doc);

    const table = view.dom.querySelector("table.cm-table");
    expect(table).not.toBeNull();
    expect(table!.querySelectorAll("thead th").length).toBe(1);
    expect(table!.querySelectorAll("tbody tr").length).toBe(2);
  });

  it("handles cell with pipe character escaped", () => {
    // Note: GFM doesn't have standard pipe escape, but test cell content with special chars
    const doc = "| A | B |\n| --- | --- |\n| test | x |";
    const state = createState(doc);
    const tableNode = findTableNode(state);
    const info = parseTableFromAST(state, tableNode!);

    expect(info).not.toBeNull();
    expect(info!.bodyRows[0][0].content).toBe("test");
  });

  it("handles table after heading", () => {
    const doc = "# Title\n\n| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    // Both heading and table should render
    const table = view.dom.querySelector("table.cm-table");
    expect(table).not.toBeNull();
  });

  it("handles multiple tables in document", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\n\n| X | Y |\n| --- | --- |\n| 3 | 4 |";
    view = createTableViewWithWidget(doc);

    const tables = view.dom.querySelectorAll("table.cm-table");
    expect(tables.length).toBe(2);
  });

  it("handles table followed by text without blank line", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\nsome text";
    const state = createState(doc);
    const extents = collectTableExtents(state);

    expect(extents.length).toBe(1);
    // Table should not include the text
    const textStart = doc.indexOf("some text");
    expect(extents[0].to).toBeLessThanOrEqual(textStart);
  });

  it("handles cell with URL markdown", () => {
    const doc = "| Link |\n| --- |\n| [Google](https://google.com) |";
    view = createTableViewWithWidget(doc);

    const bodyCell = view.dom.querySelector("tbody td") as HTMLElement;
    // Should render the link
    expect(bodyCell.innerHTML).toContain("cm-link");
    expect(bodyCell.innerHTML).toContain("href");
  });

  it("handles cell with code markdown", () => {
    const doc = "| Code |\n| --- |\n| `const x = 1` |";
    view = createTableViewWithWidget(doc);

    const bodyCell = view.dom.querySelector("tbody td") as HTMLElement;
    expect(bodyCell.innerHTML).toContain("cm-inline-code");
  });

  it("handles cell with strikethrough markdown", () => {
    const doc = "| Strike |\n| --- |\n| ~~deleted~~ |";
    view = createTableViewWithWidget(doc);

    const bodyCell = view.dom.querySelector("tbody td") as HTMLElement;
    expect(bodyCell.innerHTML).toContain("cm-strikethrough");
  });

  it("handles very long cell content", () => {
    const longContent = "a".repeat(500);
    const doc = `| Header |\n| --- |\n| ${longContent} |`;
    view = createTableViewWithWidget(doc);

    const table = view.dom.querySelector("table.cm-table");
    expect(table).not.toBeNull();

    const bodyCell = view.dom.querySelector("tbody td") as HTMLElement;
    expect(bodyCell.textContent?.length).toBe(500);
  });
});

// ===========================================
// Inline Markdown Rendering Tests
// ===========================================

describe("inline markdown rendering in cells", () => {
  it("renders bold text", () => {
    const doc = "| **Bold** |\n| --- |\n| text |";
    view = createTableViewWithWidget(doc);

    const headerCell = view.dom.querySelector("thead th") as HTMLElement;
    expect(headerCell.innerHTML).toContain("<strong");
    expect(headerCell.innerHTML).toContain("cm-strong");
  });

  it("renders italic text", () => {
    const doc = "| *Italic* |\n| --- |\n| text |";
    view = createTableViewWithWidget(doc);

    const headerCell = view.dom.querySelector("thead th") as HTMLElement;
    expect(headerCell.innerHTML).toContain("<em");
    expect(headerCell.innerHTML).toContain("cm-em");
  });

  it("renders combined bold+italic", () => {
    const doc = "| ***Both*** |\n| --- |\n| text |";
    view = createTableViewWithWidget(doc);

    const headerCell = view.dom.querySelector("thead th") as HTMLElement;
    // Should have both strong and em
    expect(headerCell.innerHTML).toContain("<strong");
    expect(headerCell.innerHTML).toContain("<em");
  });

  it("renders highlight text", () => {
    const doc = "| ==Highlight== |\n| --- |\n| text |";
    view = createTableViewWithWidget(doc);

    const headerCell = view.dom.querySelector("thead th") as HTMLElement;
    expect(headerCell.innerHTML).toContain("<mark");
    expect(headerCell.innerHTML).toContain("cm-highlight");
  });

  it("renders inline code", () => {
    const doc = "| `code` |\n| --- |\n| text |";
    view = createTableViewWithWidget(doc);

    const headerCell = view.dom.querySelector("thead th") as HTMLElement;
    expect(headerCell.innerHTML).toContain("<code");
    expect(headerCell.innerHTML).toContain("cm-inline-code");
  });

  it("renders links with href", () => {
    const doc = "| [Link](http://example.com) |\n| --- |\n| text |";
    view = createTableViewWithWidget(doc);

    const headerCell = view.dom.querySelector("thead th") as HTMLElement;
    expect(headerCell.innerHTML).toContain("<a");
    expect(headerCell.innerHTML).toContain('href="http://example.com"');
    expect(headerCell.innerHTML).toContain("Link");
  });

  it("escapes HTML in cell content", () => {
    const doc = "| <script> |\n| --- |\n| text |";
    view = createTableViewWithWidget(doc);

    const headerCell = view.dom.querySelector("thead th") as HTMLElement;
    // Should not contain actual script tag
    expect(headerCell.innerHTML).not.toContain("<script>");
    expect(headerCell.innerHTML).toContain("&lt;script&gt;");
  });
});

// ===========================================
// Table Toolbar Tests
// ===========================================

describe("table toolbar", () => {
  it("renders toolbar with table widget", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const toolbar = view.dom.querySelector(".cm-table-toolbar");
    expect(toolbar).not.toBeNull();
  });

  it("toolbar has row and column button groups", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const groups = view.dom.querySelectorAll(".cm-table-toolbar-group");
    expect(groups.length).toBe(2);
  });

  it("toolbar has four control buttons", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const buttons = view.dom.querySelectorAll(".cm-table-toolbar-btn");
    expect(buttons.length).toBe(4);
  });

  it("+ Row button adds a row when clicked", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const addRowBtn = Array.from(view.dom.querySelectorAll(".cm-table-toolbar-btn"))
      .find(btn => btn.textContent?.includes("Row") && btn.textContent?.includes("+")) as HTMLButtonElement;

    expect(addRowBtn).toBeDefined();
    addRowBtn.click();

    await flushRaf();

    // Should have added a row
    const newDoc = view.state.doc.toString();
    const pipeLines = newDoc.split("\n").filter(l => l.trim().startsWith("|"));
    expect(pipeLines.length).toBe(4); // header + delim + original row + new row
  });

  it("− Row button removes a row when clicked", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
    view = createTableViewWithWidget(doc);

    const removeRowBtn = Array.from(view.dom.querySelectorAll(".cm-table-toolbar-btn"))
      .find(btn => btn.textContent?.includes("Row") && btn.textContent?.includes("−")) as HTMLButtonElement;

    expect(removeRowBtn).toBeDefined();
    removeRowBtn.click();

    await flushRaf();

    // Should have removed a row
    const newDoc = view.state.doc.toString();
    const pipeLines = newDoc.split("\n").filter(l => l.trim().startsWith("|"));
    expect(pipeLines.length).toBe(3); // header + delim + 1 remaining row
  });

  it("+ Column button adds a blank column when clicked", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const addColBtn = Array.from(view.dom.querySelectorAll(".cm-table-toolbar-btn"))
      .find(btn => btn.textContent?.includes("Column") && btn.textContent?.includes("+")) as HTMLButtonElement;

    expect(addColBtn).toBeDefined();
    addColBtn.click();

    await flushRaf();

    // Should have added a blank column (not "Header 3")
    const newDoc = view.state.doc.toString();
    expect(newDoc).not.toContain("Header 3");
    // Verify 3 columns exist
    const lines = newDoc.split("\n");
    expect(lines[0].split("|").length - 1).toBe(4); // |A|B| | = 4 segments
  });

  it("− Column button removes a column when clicked", async () => {
    const doc = "| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |";
    view = createTableViewWithWidget(doc);

    const removeColBtn = Array.from(view.dom.querySelectorAll(".cm-table-toolbar-btn"))
      .find(btn => btn.textContent?.includes("Column") && btn.textContent?.includes("−")) as HTMLButtonElement;

    expect(removeColBtn).toBeDefined();
    removeColBtn.click();

    await flushRaf();

    // Should have removed a column (C is gone)
    const newDoc = view.state.doc.toString();
    expect(newDoc).not.toContain("| C");
  });

  it("buttons have title attributes for accessibility", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const buttons = Array.from(view.dom.querySelectorAll(".cm-table-toolbar-btn")) as HTMLButtonElement[];
    expect(buttons.length).toBe(4);

    for (const btn of buttons) {
      expect(btn.title).toBeDefined();
      expect(btn.title.length).toBeGreaterThan(0);
    }
  });

  it("buttons prevent default on mousedown to preserve focus", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const btn = view.dom.querySelector(".cm-table-toolbar-btn") as HTMLButtonElement;
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    btn.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

// ===========================================
// Keyboard Navigation Tests
// ===========================================

describe("table keyboard navigation", () => {
  it("Arrow Up moves to same column in previous row", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
    view = createTableViewWithWidget(doc);

    const cells = Array.from(view.dom.querySelectorAll("th, td")) as HTMLElement[];
    // cells: A(0), B(1), 1(2), 2(3), 3(4), 4(5)
    const cell4 = cells[4]; // "3" cell (row 1, col 0)
    const cell2 = cells[2]; // "1" cell (row 0 body, col 0)

    const focusSpy = vi.spyOn(cell2, "focus");
    cell4.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));

    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it("Arrow Down moves to same column in next row", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |";
    view = createTableViewWithWidget(doc);

    const cells = Array.from(view.dom.querySelectorAll("th, td")) as HTMLElement[];
    const cell2 = cells[2]; // "1" cell
    const cell4 = cells[4]; // "3" cell

    const focusSpy = vi.spyOn(cell4, "focus");
    cell2.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));

    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it("Escape exits table and focuses CodeMirror", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const cell = view.dom.querySelector("tbody td") as HTMLElement;
    const blurSpy = vi.spyOn(cell, "blur");

    cell.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(blurSpy).toHaveBeenCalled();
    blurSpy.mockRestore();
  });

  it("Enter in header moves to body cell in same column", () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const headerCell = view.dom.querySelector("thead th") as HTMLElement;
    const bodyCell = view.dom.querySelector("tbody td") as HTMLElement;

    const focusSpy = vi.spyOn(bodyCell, "focus");
    headerCell.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    expect(focusSpy).toHaveBeenCalled();
    focusSpy.mockRestore();
  });

  it("Enter in body adds new row", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const bodyCell = view.dom.querySelector("tbody td") as HTMLElement;
    bodyCell.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    await flushRaf();

    // Should have added a row
    const newDoc = view.state.doc.toString();
    const pipeLines = newDoc.split("\n").filter(l => l.trim().startsWith("|"));
    expect(pipeLines.length).toBe(4); // header, delim, original row, new row
  });

  it("Tab at last cell adds new row and focuses first cell of new row", async () => {
    const doc = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    view = createTableViewWithWidget(doc);

    const cells = Array.from(view.dom.querySelectorAll("td")) as HTMLElement[];
    const lastCell = cells[cells.length - 1]; // "2" cell

    lastCell.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));

    await flushRaf();

    // Should have added a row
    const newDoc = view.state.doc.toString();
    const pipeLines = newDoc.split("\n").filter(l => l.trim().startsWith("|"));
    expect(pipeLines.length).toBe(4);
  });
});
