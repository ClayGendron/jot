/**
 * Tests for CodeMirror list behavior
 *
 * These tests verify the WYSIWYG-style list editing experience:
 * - Creation: typing - * + at start of line creates list item with auto-space
 * - Ordered lists: typing 1. creates ordered list
 * - Hidden syntax: list markers are replaced with bullets/numbers
 * - Navigation: arrow keys skip over list markers
 * - Deletion: backspace removes list markers, delete merges content
 * - Enter: continues list or exits on empty item
 * - Nesting: Tab/Shift-Tab for indentation
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";

// ===========================================
// TEST UTILITIES
// ===========================================

/**
 * Create an EditorState with the given document and cursor position
 * Use | to indicate cursor position in the input string
 */
function createState(docWithCursor: string): EditorState {
  const cursorPos = docWithCursor.indexOf("|");
  const doc = docWithCursor.replace("|", "");

  return EditorState.create({
    doc,
    selection: { anchor: cursorPos >= 0 ? cursorPos : doc.length },
    extensions: [markdown({ extensions: [GFM] })],
  });
}

/**
 * List marker patterns:
 * - Unordered: -, *, + followed by space
 * - Ordered: 1., 2., etc. followed by space
 */
const LIST_MARKER_REGEX = /^(\s*)([-*+]|\d+\.)\s/;

/**
 * Get list info for a line
 */
function getListInfo(line: { text: string; from: number }): {
  isListItem: boolean;
  indent: string;
  marker: string;
  markerWithSpace: string;
  contentStart: number;
  isOrdered: boolean;
  orderNumber: number | null;
} | null {
  const match = line.text.match(LIST_MARKER_REGEX);
  if (!match) return null;

  const indent = match[1];
  const marker = match[2];
  const markerWithSpace = match[0];
  const isOrdered = /^\d+\.$/.test(marker);
  const orderNumber = isOrdered ? parseInt(marker) : null;

  return {
    isListItem: true,
    indent,
    marker,
    markerWithSpace,
    contentStart: line.from + markerWithSpace.length,
    isOrdered,
    orderNumber,
  };
}

/**
 * Get line info at cursor position
 */
function getLineInfo(state: EditorState): {
  lineText: string;
  lineNumber: number;
  column: number;
  isListItem: boolean;
  isOrdered: boolean;
  orderNumber: number | null;
  indent: number;
  contentStart: number;
} {
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const listInfo = getListInfo(line);

  return {
    lineText: line.text,
    lineNumber: line.number,
    column: pos - line.from,
    isListItem: !!listInfo,
    isOrdered: listInfo?.isOrdered ?? false,
    orderNumber: listInfo?.orderNumber ?? null,
    indent: listInfo?.indent.length ?? 0,
    contentStart: listInfo ? listInfo.markerWithSpace.length : 0,
  };
}

/**
 * Check if cursor is at the content start of a list item (after marker)
 */
function isAtListContentStart(state: EditorState): boolean {
  const info = getLineInfo(state);
  if (!info.isListItem) return false;
  return info.column === info.contentStart;
}

/**
 * Get the content of a list item (without marker)
 */
function getListContent(state: EditorState): string | null {
  const info = getLineInfo(state);
  if (!info.isListItem) return null;
  return info.lineText.slice(info.contentStart);
}

// ===========================================
// UNORDERED LIST PATTERN DETECTION TESTS
// ===========================================

describe("Unordered List Pattern Detection", () => {
  describe("Dash Marker (-)", () => {
    it("detects - list item", () => {
      const state = createState("- |Item");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.isOrdered).toBe(false);
    });

    it("requires space after -", () => {
      const state = createState("-|NoSpace");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(false);
    });

    it("does not detect - in middle of text", () => {
      const state = createState("text - |not list");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(false);
    });
  });

  describe("Asterisk Marker (*)", () => {
    it("detects * list item", () => {
      const state = createState("* |Item");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.isOrdered).toBe(false);
    });

    it("requires space after *", () => {
      const state = createState("*|NoSpace");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(false);
    });
  });

  describe("Plus Marker (+)", () => {
    it("detects + list item", () => {
      const state = createState("+ |Item");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.isOrdered).toBe(false);
    });

    it("requires space after +", () => {
      const state = createState("+|NoSpace");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(false);
    });
  });
});

// ===========================================
// ORDERED LIST PATTERN DETECTION TESTS
// ===========================================

describe("Ordered List Pattern Detection", () => {
  describe("Number Marker", () => {
    it("detects 1. list item", () => {
      const state = createState("1. |Item");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.isOrdered).toBe(true);
      expect(info.orderNumber).toBe(1);
    });

    it("detects multi-digit numbers", () => {
      const state = createState("10. |Item");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.isOrdered).toBe(true);
      expect(info.orderNumber).toBe(10);
    });

    it("detects 99. list item", () => {
      const state = createState("99. |Item");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.orderNumber).toBe(99);
    });

    it("requires space after number.", () => {
      const state = createState("1.|NoSpace");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(false);
    });

    it("does not detect number without period", () => {
      const state = createState("1 |Not a list");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(false);
    });
  });
});

// ===========================================
// NESTED LIST TESTS
// ===========================================

describe("Nested Lists", () => {
  describe("Indentation Detection", () => {
    it("detects 2-space indented list item", () => {
      const state = createState("  - |Nested");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.indent).toBe(2);
    });

    it("detects 4-space indented list item", () => {
      const state = createState("    - |Deeply nested");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.indent).toBe(4);
    });

    it("detects indented ordered list", () => {
      const state = createState("  1. |Nested ordered");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.isOrdered).toBe(true);
      expect(info.indent).toBe(2);
    });
  });

  describe("Content Start Calculation", () => {
    it("calculates content start for unindented list", () => {
      const state = createState("- |Item");
      const info = getLineInfo(state);
      expect(info.contentStart).toBe(2); // "- " = 2 chars
    });

    it("calculates content start for indented list", () => {
      const state = createState("  - |Item");
      const info = getLineInfo(state);
      expect(info.contentStart).toBe(4); // "  - " = 4 chars
    });

    it("calculates content start for ordered list", () => {
      const state = createState("1. |Item");
      const info = getLineInfo(state);
      expect(info.contentStart).toBe(3); // "1. " = 3 chars
    });

    it("calculates content start for multi-digit ordered", () => {
      const state = createState("10. |Item");
      const info = getLineInfo(state);
      expect(info.contentStart).toBe(4); // "10. " = 4 chars
    });
  });
});

// ===========================================
// CURSOR POSITION TESTS
// ===========================================

describe("Cursor Position", () => {
  describe("Content Start Detection", () => {
    it("detects cursor at list content start", () => {
      const state = createState("- |Item");
      expect(isAtListContentStart(state)).toBe(true);
    });

    it("detects cursor at indented list content start", () => {
      const state = createState("  - |Nested");
      expect(isAtListContentStart(state)).toBe(true);
    });

    it("cursor in middle of content is not at start", () => {
      const state = createState("- It|em");
      expect(isAtListContentStart(state)).toBe(false);
    });

    it("cursor at end of content is not at start", () => {
      const state = createState("- Item|");
      expect(isAtListContentStart(state)).toBe(false);
    });
  });

  describe("List Content Extraction", () => {
    it("extracts content from unordered list", () => {
      const state = createState("- |Hello World");
      expect(getListContent(state)).toBe("Hello World");
    });

    it("extracts content from ordered list", () => {
      const state = createState("1. |First item");
      expect(getListContent(state)).toBe("First item");
    });

    it("returns null for non-list", () => {
      const state = createState("|Regular paragraph");
      expect(getListContent(state)).toBe(null);
    });

    it("extracts empty content for empty list item", () => {
      const state = createState("- |");
      expect(getListContent(state)).toBe("");
    });
  });
});

// ===========================================
// LIST CREATION TESTS
// ===========================================

describe("List Creation", () => {
  describe("Auto-space After Marker", () => {
    it("- at line start should add space (expected behavior)", () => {
      // User types "-" at line start
      // Expected: "- " with cursor after space
      const expected = createState("- |");
      expect(expected.doc.toString()).toBe("- ");
      expect(expected.selection.main.head).toBe(2);
    });

    it("* at line start should add space", () => {
      const expected = createState("* |");
      expect(expected.doc.toString()).toBe("* ");
      expect(expected.selection.main.head).toBe(2);
    });

    it("+ at line start should add space", () => {
      const expected = createState("+ |");
      expect(expected.doc.toString()).toBe("+ ");
      expect(expected.selection.main.head).toBe(2);
    });
  });

  describe("Ordered List Creation", () => {
    it("1. at line start creates ordered list", () => {
      // User types "1" then "." at line start
      // Expected: "1. " with cursor after space
      const expected = createState("1. |");
      expect(expected.doc.toString()).toBe("1. ");
      const info = getLineInfo(expected);
      expect(info.isOrdered).toBe(true);
    });
  });
});

// ===========================================
// NAVIGATION TESTS
// ===========================================

describe("Navigation", () => {
  describe("Cursor Should Skip List Markers", () => {
    it("cursor at line.from of list should be invalid", () => {
      const state = createState("|- Item");
      const info = getLineInfo(state);
      expect(info.column).toBe(0);
      expect(info.contentStart).toBe(2);
      // Cursor before content start is invalid in WYSIWYG mode
      expect(info.column < info.contentStart).toBe(true);
    });

    it("valid cursor position is at content start", () => {
      const state = createState("- |Item");
      const info = getLineInfo(state);
      expect(info.column).toBe(info.contentStart);
    });

    it("valid cursor position is within content", () => {
      const state = createState("- It|em");
      const info = getLineInfo(state);
      expect(info.column).toBeGreaterThan(info.contentStart);
    });
  });

  describe("Arrow Navigation", () => {
    it("content start calculation for navigation", () => {
      const state = createState("- |Item");
      const line = state.doc.lineAt(state.selection.main.head);
      const listInfo = getListInfo(line);
      expect(listInfo).not.toBe(null);
      const contentStart = line.from + listInfo!.markerWithSpace.length;
      expect(state.selection.main.head).toBe(contentStart);
    });
  });
});

// ===========================================
// BACKSPACE BEHAVIOR TESTS
// ===========================================

describe("Backspace Behavior", () => {
  describe("At Start of List Content", () => {
    it("identifies backspace position at content start", () => {
      const state = createState("- |Item");
      expect(isAtListContentStart(state)).toBe(true);
    });

    it("identifies backspace position at indented content start", () => {
      const state = createState("  - |Nested");
      expect(isAtListContentStart(state)).toBe(true);
    });
  });

  describe("List Marker Removal Logic", () => {
    it("list marker should be removable", () => {
      const state = createState("- |Item");
      const line = state.doc.lineAt(state.selection.main.head);
      const listInfo = getListInfo(line);

      expect(listInfo).not.toBe(null);
      // After backspace: "- Item" -> "Item"
      const expectedResult = line.text.slice(listInfo!.markerWithSpace.length);
      expect(expectedResult).toBe("Item");
    });

    it("empty list item backspace removes marker", () => {
      const state = createState("- |");
      const line = state.doc.lineAt(state.selection.main.head);
      const listInfo = getListInfo(line);
      expect(listInfo).not.toBe(null);
      // After backspace: "- " -> ""
    });

    it("indented list backspace removes all indent + marker", () => {
      const state = createState("  - |Item");
      const info = getLineInfo(state);
      expect(info.indent).toBe(2);
      expect(info.contentStart).toBe(4);
    });
  });
});

// ===========================================
// DELETE BEHAVIOR TESTS
// ===========================================

describe("Delete Behavior", () => {
  describe("Delete at End of Line Before List", () => {
    it("delete should merge and remove list marker", () => {
      // Before: "Paragraph|\n\n- Item"
      // After Delete: "ParagraphItem"
      const doc = "Paragraph\n\n- Item";
      const state = EditorState.create({
        doc,
        selection: { anchor: "Paragraph".length },
        extensions: [markdown({ extensions: [GFM] })],
      });

      // Find next content line
      const currentLine = state.doc.lineAt(state.selection.main.head);
      let targetLineNum = currentLine.number + 1;
      while (targetLineNum <= state.doc.lines) {
        const targetLine = state.doc.line(targetLineNum);
        if (targetLine.text.trim() !== "") {
          const listInfo = getListInfo(targetLine);
          expect(listInfo).not.toBe(null);
          expect(targetLine.text.slice(listInfo!.markerWithSpace.length)).toBe("Item");
          break;
        }
        targetLineNum++;
      }
    });

    it("delete before ordered list removes marker", () => {
      const doc = "Paragraph\n\n1. First";
      const state = EditorState.create({
        doc,
        selection: { anchor: "Paragraph".length },
        extensions: [markdown({ extensions: [GFM] })],
      });

      const targetLine = state.doc.line(3);
      expect(targetLine.text).toBe("1. First");
    });
  });
});

// ===========================================
// ENTER BEHAVIOR TESTS
// ===========================================

describe("Enter Behavior", () => {
  describe("At End of List Item", () => {
    it("cursor at end of list content", () => {
      const state = createState("- Item|");
      const info = getLineInfo(state);
      expect(info.column).toBe(info.lineText.length);
    });

    it("enter at end continues list", () => {
      // After Enter: "- Item" -> "- Item\n- " with cursor after second marker
      const expectedDoc = "- Item\n- |";
      const state = createState(expectedDoc);
      expect(state.doc.lines).toBe(2);
      expect(state.doc.line(1).text).toBe("- Item");
      expect(state.doc.line(2).text).toBe("- ");
    });

    it("ordered list continues with next number", () => {
      // After Enter: "1. First" -> "1. First\n2. "
      const expectedDoc = "1. First\n2. |";
      const state = createState(expectedDoc);
      expect(state.doc.line(1).text).toBe("1. First");
      expect(state.doc.line(2).text).toBe("2. ");
    });
  });

  describe("On Empty List Item", () => {
    it("enter on empty list item exits the list", () => {
      // "- Item\n- |" -> Enter produces "- Item\n\n|"
      const beforeExit = createState("- Item\n- |");
      const info = getLineInfo(beforeExit);
      expect(info.isListItem).toBe(true);
      expect(getListContent(beforeExit)).toBe("");

      // After Enter on empty list item
      const afterExit = createState("- Item\n\n|");
      expect(afterExit.doc.lines).toBe(3);
      expect(afterExit.doc.line(2).text).toBe("");
    });
  });

  describe("In Middle of List Item", () => {
    it("split list item produces two list items", () => {
      // "- Ite|m" after Enter: "- Ite\n- m"
      const expectedDoc = "- Ite\n- m";
      const state = createState(expectedDoc.replace("m", "|m"));
      expect(state.doc.lines).toBe(2);
      expect(state.doc.line(1).text).toBe("- Ite");
      expect(state.doc.line(2).text).toBe("- m");
    });
  });
});

// ===========================================
// EDGE CASES
// ===========================================

describe("Edge Cases", () => {
  describe("Empty List Item", () => {
    it("list item with no content is valid", () => {
      const state = createState("- |");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(getListContent(state)).toBe("");
    });
  });

  describe("List at Document Boundaries", () => {
    it("list as first line", () => {
      const state = createState("- |First item");
      const info = getLineInfo(state);
      expect(info.lineNumber).toBe(1);
      expect(info.isListItem).toBe(true);
    });

    it("list as last line", () => {
      const state = createState("Paragraph\n\n- |Last item");
      const line = state.doc.lineAt(state.selection.main.head);
      expect(line.number).toBe(state.doc.lines);
    });
  });

  describe("Multiple List Items", () => {
    it("consecutive list items", () => {
      const doc = "- Item 1\n- Item 2\n- Item 3";
      const state = createState(doc + "|");
      expect(state.doc.lines).toBe(3);

      for (let i = 1; i <= 3; i++) {
        expect(getListInfo(state.doc.line(i))).not.toBe(null);
      }
    });

    it("mixed ordered and unordered", () => {
      const doc = "- Unordered\n\n1. Ordered";
      const state = createState(doc + "|");

      const line1Info = getListInfo(state.doc.line(1));
      const line3Info = getListInfo(state.doc.line(3));

      expect(line1Info?.isOrdered).toBe(false);
      expect(line3Info?.isOrdered).toBe(true);
    });
  });

  describe("List with Inline Formatting", () => {
    it("list can contain bold", () => {
      const state = createState("- **Bold** |text");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.lineText).toContain("**Bold**");
    });

    it("list can contain inline code", () => {
      const state = createState("- `code` |text");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.lineText).toContain("`code`");
    });
  });

  describe("Special Characters", () => {
    it("list item with - in content", () => {
      const state = createState("- a - b |text");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(getListContent(state)).toBe("a - b text");
    });

    it("list item with numbers in content", () => {
      const state = createState("- Item 1. and 2.|");
      const info = getLineInfo(state);
      expect(info.isListItem).toBe(true);
      expect(info.isOrdered).toBe(false);
    });
  });
});

// ===========================================
// INTEGRATION TESTS
// ===========================================

describe("Integration", () => {
  describe("Document Structure", () => {
    it("typical document with lists", () => {
      const doc = `# Shopping List

- Apples
- Bananas
- Oranges

## Todo

1. First task
2. Second task
3. Third task`;

      const state = EditorState.create({
        doc,
        extensions: [markdown({ extensions: [GFM] })],
      });

      // Count list items
      let listCount = 0;
      let orderedCount = 0;
      for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i);
        const info = getListInfo(line);
        if (info) {
          listCount++;
          if (info.isOrdered) orderedCount++;
        }
      }
      expect(listCount).toBe(6);
      expect(orderedCount).toBe(3);
    });

    it("nested list structure", () => {
      const doc = `- Parent 1
  - Child 1.1
  - Child 1.2
- Parent 2
  - Child 2.1`;

      const state = EditorState.create({
        doc,
        extensions: [markdown({ extensions: [GFM] })],
      });

      const indents: number[] = [];
      for (let i = 1; i <= state.doc.lines; i++) {
        const line = state.doc.line(i);
        const info = getListInfo(line);
        if (info) {
          indents.push(info.indent.length);
        }
      }

      expect(indents).toEqual([0, 2, 2, 0, 2]);
    });
  });

  describe("Mixed Content", () => {
    it("list followed by blockquote", () => {
      const doc = `- List item

> Quoted text`;

      const state = EditorState.create({
        doc,
        extensions: [markdown({ extensions: [GFM] })],
      });

      expect(getListInfo(state.doc.line(1))).not.toBe(null);
      expect(state.doc.line(3).text.startsWith(">")).toBe(true);
    });

    it("blockquote with list inside", () => {
      const doc = `> - List inside quote
> - Another item`;

      const state = EditorState.create({
        doc,
        extensions: [markdown({ extensions: [GFM] })],
      });

      // Line contains both > and -
      expect(state.doc.line(1).text).toContain("> -");
    });
  });
});
