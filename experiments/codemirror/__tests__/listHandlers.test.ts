/**
 * Integration tests for list handlers
 *
 * Tests cover:
 * - handleEnterInList: Continue/exit list on Enter
 * - handleBackspaceInList: Remove marker or merge on Backspace
 * - handleTabInList: Indent list item
 * - handleShiftTabInList: Outdent list item
 * - getListInfo: Parse list markers
 * - getNextOrderNumber: Get next number for ordered list
 * - isAtListContentStart: Check if cursor at list content start
 * - toggleTaskCheckboxOnLine: Toggle task checkbox via keyboard
 * - Task list continuation: Enter on task list continues with [ ]
 */

import { describe, it, expect, afterEach } from "vitest";
import { createTestView, getDocWithCursor, type TestView, typeText } from "./testUtils";
import {
  handleEnterInList,
  handleBackspaceInList,
  handleTabInList,
  handleShiftTabInList,
  getListInfo,
  getNextOrderNumber,
  isAtListContentStart,
  toggleTaskCheckboxOnLine,
  buildNewListMarker,
} from "../harness";

describe("List Handlers", () => {
  let testView: TestView;

  afterEach(() => {
    testView?.destroy();
  });

  describe("handleEnterInList", () => {
    it("continues unordered list with -", () => {
      testView = createTestView("- Item|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("- Item\n- |");
    });

    it("continues unordered list with *", () => {
      testView = createTestView("* Item|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("* Item\n* |");
    });

    it("continues unordered list with +", () => {
      testView = createTestView("+ Item|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("+ Item\n+ |");
    });

    it("continues ordered list with next number", () => {
      testView = createTestView("1. First|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("1. First\n2. |");
    });

    it("continues ordered list from higher number", () => {
      testView = createTestView("5. Fifth|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("5. Fifth\n6. |");
    });

    it("exits list on empty item", () => {
      testView = createTestView("- Item\n- |");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("- Item\n\n|");
    });

    it("exits ordered list on empty item", () => {
      testView = createTestView("1. Item\n2. |");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("1. Item\n\n|");
    });

    it("preserves indentation", () => {
      testView = createTestView("  - Nested|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("  - Nested\n  - |");
    });

    it("splits list item in middle", () => {
      testView = createTestView("- Hel|lo");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("- Hel\n- |lo");
    });

    it("returns false for non-list line", () => {
      testView = createTestView("Regular text|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(false);
    });

    it("exits list and moves content to plain text when at content start", () => {
      testView = createTestView("- |Item");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      // Should keep marker as empty list item and move content to plain text below
      expect(getDocWithCursor(testView.view)).toBe("-\n\n|Item");
    });
  });

  describe("handleBackspaceInList", () => {
    it("removes marker on empty list item", () => {
      testView = createTestView("- |");

      const handled = handleBackspaceInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("|");
    });

    it("removes marker and keeps content", () => {
      testView = createTestView("- |Content");

      const handled = handleBackspaceInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("|Content");
    });

    it("removes marker and converts to plain text with paragraph spacing", () => {
      testView = createTestView("- Line 1\n- |Line 2");

      const handled = handleBackspaceInList(testView.view);

      expect(handled).toBe(true);
      // Should remove marker and add paragraph spacing, not merge into previous list item
      expect(getDocWithCursor(testView.view)).toBe("- Line 1\n\n|Line 2");
    });

    it("returns false when not at content start", () => {
      testView = createTestView("- Hel|lo");

      const handled = handleBackspaceInList(testView.view);

      expect(handled).toBe(false);
    });

    it("removes marker on first line", () => {
      testView = createTestView("- |First content");

      const handled = handleBackspaceInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("|First content");
    });

    it("removes marker with paragraph spacing when previous line is blank", () => {
      testView = createTestView("Content\n\n- |Item");

      const handled = handleBackspaceInList(testView.view);

      expect(handled).toBe(true);
      // Should remove marker and add paragraph spacing from blank line
      expect(getDocWithCursor(testView.view)).toBe("Content\n\n\n|Item");
    });

    it("preserves indentation when removing marker", () => {
      testView = createTestView("  - |Item");

      const handled = handleBackspaceInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("  |Item");
    });

    it("returns false for non-list line", () => {
      testView = createTestView("|Regular");

      const handled = handleBackspaceInList(testView.view);

      expect(handled).toBe(false);
    });
  });

  describe("handleTabInList", () => {
    it("adds 2 spaces of indentation", () => {
      testView = createTestView("- |Item");

      const handled = handleTabInList(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.line(1).text).toBe("  - Item");
    });

    it("adds indentation to already indented list", () => {
      testView = createTestView("  - |Item");

      const handled = handleTabInList(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.line(1).text).toBe("    - Item");
    });

    it("moves cursor correctly after indent", () => {
      testView = createTestView("- |Item");

      handleTabInList(testView.view);

      // Cursor should move forward by 2 (the indent amount)
      expect(testView.view.state.selection.main.head).toBe(4); // "  - |"
    });

    it("returns false for non-list line", () => {
      testView = createTestView("|Regular");

      const handled = handleTabInList(testView.view);

      expect(handled).toBe(false);
    });

    it("works for ordered lists", () => {
      testView = createTestView("1. |Item");

      const handled = handleTabInList(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.line(1).text).toBe("  1. Item");
    });
  });

  describe("integration: indent UL → backspace → convert to OL", () => {
    it("keeps indent after removing bullet and allows ordered marker", () => {
      testView = createTestView("- |Item");

      const indented = handleTabInList(testView.view);
      expect(indented).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("  - |Item");

      const removed = handleBackspaceInList(testView.view);
      expect(removed).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("  |Item");

      typeText(testView.view, "1. ");
      expect(getDocWithCursor(testView.view)).toBe("  1. |Item");
    });
  });

  describe("handleShiftTabInList", () => {
    it("removes up to 2 spaces of indentation", () => {
      testView = createTestView("  - |Item");

      const handled = handleShiftTabInList(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.line(1).text).toBe("- Item");
    });

    it("removes only available indentation", () => {
      testView = createTestView(" - |Item"); // Only 1 space

      const handled = handleShiftTabInList(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.line(1).text).toBe("- Item");
    });

    it("returns false with no indentation", () => {
      testView = createTestView("- |Item");

      const handled = handleShiftTabInList(testView.view);

      expect(handled).toBe(false);
    });

    it("removes from deeply indented list", () => {
      testView = createTestView("    - |Item");

      const handled = handleShiftTabInList(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.line(1).text).toBe("  - Item");
    });
  });

  describe("getListInfo", () => {
    it("detects unordered list with -", () => {
      testView = createTestView("- Item|");
      const line = testView.view.state.doc.line(1);

      const info = getListInfo(line);

      expect(info).not.toBe(null);
      expect(info!.isListItem).toBe(true);
      expect(info!.marker).toBe("-");
      expect(info!.isOrdered).toBe(false);
      expect(info!.contentStart).toBe(2);
    });

    it("detects unordered list with *", () => {
      testView = createTestView("* Item|");
      const line = testView.view.state.doc.line(1);

      const info = getListInfo(line);

      expect(info).not.toBe(null);
      expect(info!.marker).toBe("*");
      expect(info!.isOrdered).toBe(false);
    });

    it("detects unordered list with +", () => {
      testView = createTestView("+ Item|");
      const line = testView.view.state.doc.line(1);

      const info = getListInfo(line);

      expect(info).not.toBe(null);
      expect(info!.marker).toBe("+");
    });

    it("detects ordered list", () => {
      testView = createTestView("1. Item|");
      const line = testView.view.state.doc.line(1);

      const info = getListInfo(line);

      expect(info).not.toBe(null);
      expect(info!.isOrdered).toBe(true);
      expect(info!.orderNumber).toBe(1);
      expect(info!.marker).toBe("1.");
    });

    it("detects ordered list with higher numbers", () => {
      testView = createTestView("42. Item|");
      const line = testView.view.state.doc.line(1);

      const info = getListInfo(line);

      expect(info).not.toBe(null);
      expect(info!.orderNumber).toBe(42);
    });

    it("detects indented list", () => {
      testView = createTestView("  - Item|");
      const line = testView.view.state.doc.line(1);

      const info = getListInfo(line);

      expect(info).not.toBe(null);
      expect(info!.indent).toBe("  ");
      expect(info!.contentStart).toBe(4);
    });

    it("returns null for non-list", () => {
      testView = createTestView("Regular|");
      const line = testView.view.state.doc.line(1);

      const info = getListInfo(line);

      expect(info).toBe(null);
    });

    it("returns null for line starting with dash but no space", () => {
      testView = createTestView("-NoSpace|");
      const line = testView.view.state.doc.line(1);

      const info = getListInfo(line);

      expect(info).toBe(null);
    });
  });

  describe("getNextOrderNumber", () => {
    it("returns next number for ordered list", () => {
      testView = createTestView("1. Item|");

      const nextNum = getNextOrderNumber(testView.view.state, 1);

      expect(nextNum).toBe(2);
    });

    it("returns next number for higher starting point", () => {
      testView = createTestView("5. Item|");

      const nextNum = getNextOrderNumber(testView.view.state, 1);

      expect(nextNum).toBe(6);
    });

    it("returns 1 for unordered list", () => {
      testView = createTestView("- Item|");

      const nextNum = getNextOrderNumber(testView.view.state, 1);

      expect(nextNum).toBe(1);
    });

    it("returns 1 for non-list line", () => {
      testView = createTestView("Regular|");

      const nextNum = getNextOrderNumber(testView.view.state, 1);

      expect(nextNum).toBe(1);
    });
  });

  describe("isAtListContentStart", () => {
    it("returns true when at content start", () => {
      testView = createTestView("- |Item");

      const result = isAtListContentStart(testView.view.state);

      expect(result).toBe(true);
    });

    it("returns false when in middle of content", () => {
      testView = createTestView("- It|em");

      const result = isAtListContentStart(testView.view.state);

      expect(result).toBe(false);
    });

    it("returns false when at end of content", () => {
      testView = createTestView("- Item|");

      const result = isAtListContentStart(testView.view.state);

      expect(result).toBe(false);
    });

    it("returns false for non-list line", () => {
      testView = createTestView("|Regular");

      const result = isAtListContentStart(testView.view.state);

      expect(result).toBe(false);
    });
  });

  // ===========================================
  // TASK LIST TESTS
  // ===========================================

  describe("getListInfo with task lists", () => {
    it("identifies unchecked task list with -", () => {
      testView = createTestView("- [ ] Task|");
      const line = testView.view.state.doc.lineAt(0);

      const result = getListInfo(line);

      expect(result).not.toBeNull();
      expect(result!.isTask).toBe(true);
      expect(result!.isTaskChecked).toBe(false);
      expect(result!.taskMarkerStart).toBe(2); // Position of [ after "- "
    });

    it("identifies checked task list with -", () => {
      testView = createTestView("- [x] Task|");
      const line = testView.view.state.doc.lineAt(0);

      const result = getListInfo(line);

      expect(result).not.toBeNull();
      expect(result!.isTask).toBe(true);
      expect(result!.isTaskChecked).toBe(true);
      expect(result!.taskMarkerStart).toBe(2);
    });

    it("identifies uppercase X as checked", () => {
      testView = createTestView("- [X] Task|");
      const line = testView.view.state.doc.lineAt(0);

      const result = getListInfo(line);

      expect(result).not.toBeNull();
      expect(result!.isTask).toBe(true);
      expect(result!.isTaskChecked).toBe(true);
    });

    it("identifies task list with * marker", () => {
      testView = createTestView("* [ ] Task|");
      const line = testView.view.state.doc.lineAt(0);

      const result = getListInfo(line);

      expect(result).not.toBeNull();
      expect(result!.isTask).toBe(true);
      expect(result!.isTaskChecked).toBe(false);
      expect(result!.marker).toBe("*");
    });

    it("identifies task list with + marker", () => {
      testView = createTestView("+ [x] Task|");
      const line = testView.view.state.doc.lineAt(0);

      const result = getListInfo(line);

      expect(result).not.toBeNull();
      expect(result!.isTask).toBe(true);
      expect(result!.isTaskChecked).toBe(true);
      expect(result!.marker).toBe("+");
    });

    it("identifies ordered task list", () => {
      testView = createTestView("1. [ ] Task|");
      const line = testView.view.state.doc.lineAt(0);

      const result = getListInfo(line);

      expect(result).not.toBeNull();
      expect(result!.isTask).toBe(true);
      expect(result!.isTaskChecked).toBe(false);
      expect(result!.isOrdered).toBe(true);
      expect(result!.orderNumber).toBe(1);
      expect(result!.taskMarkerStart).toBe(3); // Position of [ after "1. "
    });

    it("identifies ordered checked task list", () => {
      testView = createTestView("5. [x] Task|");
      const line = testView.view.state.doc.lineAt(0);

      const result = getListInfo(line);

      expect(result).not.toBeNull();
      expect(result!.isTask).toBe(true);
      expect(result!.isTaskChecked).toBe(true);
      expect(result!.isOrdered).toBe(true);
      expect(result!.orderNumber).toBe(5);
    });

    it("handles indented task list", () => {
      testView = createTestView("  - [ ] Task|");
      const line = testView.view.state.doc.lineAt(0);

      const result = getListInfo(line);

      expect(result).not.toBeNull();
      expect(result!.isTask).toBe(true);
      expect(result!.isTaskChecked).toBe(false);
      expect(result!.indent).toBe("  ");
      expect(result!.taskMarkerStart).toBe(4); // Position of [ after "  - "
    });

    it("identifies regular list as non-task", () => {
      testView = createTestView("- Regular item|");
      const line = testView.view.state.doc.lineAt(0);

      const result = getListInfo(line);

      expect(result).not.toBeNull();
      expect(result!.isTask).toBe(false);
      expect(result!.isTaskChecked).toBe(false);
      expect(result!.taskMarkerStart).toBeNull();
    });
  });

  describe("handleEnterInList with task lists", () => {
    it("continues unordered task list with unchecked [ ]", () => {
      testView = createTestView("- [ ] Task|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("- [ ] Task\n- [ ] |");
    });

    it("continues checked task list with unchecked [ ]", () => {
      testView = createTestView("- [x] Done|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      // New task should be unchecked, not copying the checked state
      expect(getDocWithCursor(testView.view)).toBe("- [x] Done\n- [ ] |");
    });

    it("continues ordered task list with unchecked [ ]", () => {
      testView = createTestView("1. [ ] First|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("1. [ ] First\n2. [ ] |");
    });

    it("continues ordered checked task list with unchecked [ ]", () => {
      testView = createTestView("3. [x] Third|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("3. [x] Third\n4. [ ] |");
    });

    it("splits task list in middle with unchecked [ ]", () => {
      testView = createTestView("- [ ] First|Second");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("- [ ] First\n- [ ] |Second");
    });

    it("exits empty task list", () => {
      testView = createTestView("- [ ] Item\n- [ ] |");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("- [ ] Item\n\n|");
    });

    it("preserves indentation in nested task list", () => {
      testView = createTestView("  - [ ] Nested|");

      const handled = handleEnterInList(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("  - [ ] Nested\n  - [ ] |");
    });
  });

  describe("toggleTaskCheckboxOnLine", () => {
    it("toggles unchecked to checked", () => {
      testView = createTestView("- [ ] Task|");

      const handled = toggleTaskCheckboxOnLine(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("- [x] Task");
    });

    it("toggles checked to unchecked", () => {
      testView = createTestView("- [x] Done|");

      const handled = toggleTaskCheckboxOnLine(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("- [ ] Done");
    });

    it("toggles uppercase X to unchecked", () => {
      testView = createTestView("- [X] Done|");

      const handled = toggleTaskCheckboxOnLine(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("- [ ] Done");
    });

    it("returns false for non-task list", () => {
      testView = createTestView("- Regular|");

      const handled = toggleTaskCheckboxOnLine(testView.view);

      expect(handled).toBe(false);
      expect(testView.view.state.doc.toString()).toBe("- Regular");
    });

    it("returns false for non-list line", () => {
      testView = createTestView("Plain text|");

      const handled = toggleTaskCheckboxOnLine(testView.view);

      expect(handled).toBe(false);
      expect(testView.view.state.doc.toString()).toBe("Plain text");
    });

    it("works with ordered task list", () => {
      testView = createTestView("1. [ ] First|");

      const handled = toggleTaskCheckboxOnLine(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("1. [x] First");
    });

    it("works when cursor is at start of task content", () => {
      testView = createTestView("- [ ] |Task");

      const handled = toggleTaskCheckboxOnLine(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("- [x] Task");
    });
  });

  describe("buildNewListMarker", () => {
    it("builds unordered non-task marker", () => {
      const listInfo = {
        isListItem: true,
        indent: "",
        marker: "-",
        markerWithSpace: "- ",
        contentStart: 2,
        isOrdered: false,
        orderNumber: null,
        isTask: false,
        isTaskChecked: false,
        taskMarkerStart: null,
      };

      const result = buildNewListMarker(listInfo, 1);

      expect(result).toBe("- ");
    });

    it("builds unordered task marker", () => {
      const listInfo = {
        isListItem: true,
        indent: "",
        marker: "-",
        markerWithSpace: "- [ ] ",
        contentStart: 6,
        isOrdered: false,
        orderNumber: null,
        isTask: true,
        isTaskChecked: false,
        taskMarkerStart: 2,
      };

      const result = buildNewListMarker(listInfo, 1);

      expect(result).toBe("- [ ] ");
    });

    it("builds ordered non-task marker", () => {
      const listInfo = {
        isListItem: true,
        indent: "",
        marker: "1.",
        markerWithSpace: "1. ",
        contentStart: 3,
        isOrdered: true,
        orderNumber: 1,
        isTask: false,
        isTaskChecked: false,
        taskMarkerStart: null,
      };

      const result = buildNewListMarker(listInfo, 2);

      expect(result).toBe("2. ");
    });

    it("builds ordered task marker", () => {
      const listInfo = {
        isListItem: true,
        indent: "",
        marker: "1.",
        markerWithSpace: "1. [ ] ",
        contentStart: 7,
        isOrdered: true,
        orderNumber: 1,
        isTask: true,
        isTaskChecked: false,
        taskMarkerStart: 3,
      };

      const result = buildNewListMarker(listInfo, 2);

      expect(result).toBe("2. [ ] ");
    });

    it("preserves indentation", () => {
      const listInfo = {
        isListItem: true,
        indent: "  ",
        marker: "-",
        markerWithSpace: "  - [ ] ",
        contentStart: 8,
        isOrdered: false,
        orderNumber: null,
        isTask: true,
        isTaskChecked: true,
        taskMarkerStart: 4,
      };

      const result = buildNewListMarker(listInfo, 1);

      expect(result).toBe("  - [ ] ");
    });
  });
});
