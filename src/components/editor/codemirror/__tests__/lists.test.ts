/**
 * Tests for List Decorations
 *
 * Phase 3: Verify list markers are hidden and replaced with
 * styled bullets, numbers, and checkboxes.
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  listField,
  extractListData,
} from "../decorations/lists";

/**
 * Helper to create an editor state with list extension
 */
function createTestState(doc: string) {
  return EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), listField],
  });
}

describe("List Decorations", () => {
  describe("listField", () => {
    it("creates decorations for unordered list with dash", () => {
      const state = createTestState("- Item 1\n- Item 2");
      const decorations = state.field(listField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for unordered list with asterisk", () => {
      const state = createTestState("* Item 1\n* Item 2");
      const decorations = state.field(listField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for unordered list with plus", () => {
      const state = createTestState("+ Item 1\n+ Item 2");
      const decorations = state.field(listField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for ordered list", () => {
      const state = createTestState("1. First\n2. Second\n3. Third");
      const decorations = state.field(listField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for task list (unchecked)", () => {
      const state = createTestState("- [ ] Todo item");
      const decorations = state.field(listField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("creates decorations for task list (checked)", () => {
      const state = createTestState("- [x] Completed item");
      const decorations = state.field(listField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles nested lists", () => {
      const state = createTestState("- Parent\n  - Child\n    - Grandchild");
      const decorations = state.field(listField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles mixed list types", () => {
      const state = createTestState("- Unordered\n1. Ordered\n- [ ] Task");
      const decorations = state.field(listField);

      expect(decorations.size).toBeGreaterThan(0);
    });

    it("handles empty document", () => {
      const state = createTestState("");
      const decorations = state.field(listField);

      expect(decorations.size).toBe(0);
    });

    it("handles document with no lists", () => {
      const state = createTestState("Just plain text.");
      const decorations = state.field(listField);

      expect(decorations.size).toBe(0);
    });

    it("does not treat dash in middle of line as list", () => {
      const state = createTestState("This is not - a list");
      const decorations = state.field(listField);

      expect(decorations.size).toBe(0);
    });
  });

  describe("extractListData", () => {
    it("extracts unordered list items", () => {
      const state = createTestState("- Item 1\n- Item 2");
      const items = extractListData(state);

      expect(items).toHaveLength(2);
      expect(items[0].type).toBe("bullet");
      expect(items[1].type).toBe("bullet");
    });

    it("extracts ordered list items with correct numbers", () => {
      const state = createTestState("1. First\n2. Second\n3. Third");
      const items = extractListData(state);

      expect(items).toHaveLength(3);
      expect(items[0].type).toBe("ordered");
      expect(items[0].number).toBe(1);
      expect(items[1].number).toBe(2);
      expect(items[2].number).toBe(3);
    });

    it("extracts task list items with checked state", () => {
      const state = createTestState("- [ ] Unchecked\n- [x] Checked");
      const items = extractListData(state);

      expect(items).toHaveLength(2);
      expect(items[0].type).toBe("task");
      expect(items[0].checked).toBe(false);
      expect(items[1].type).toBe("task");
      expect(items[1].checked).toBe(true);
    });

    it("extracts marker character for unordered lists", () => {
      const state = createTestState("- Dash\n* Asterisk\n+ Plus");
      const items = extractListData(state);

      expect(items).toHaveLength(3);
      expect(items[0].marker).toBe("-");
      expect(items[1].marker).toBe("*");
      expect(items[2].marker).toBe("+");
    });

    it("extracts indentation level for nested lists", () => {
      const state = createTestState("- Level 0\n  - Level 1\n    - Level 2");
      const items = extractListData(state);

      expect(items).toHaveLength(3);
      expect(items[0].indent).toBe(0);
      expect(items[1].indent).toBe(1);
      expect(items[2].indent).toBe(2);
    });

    it("extracts position information", () => {
      const state = createTestState("- Item");
      const items = extractListData(state);

      expect(items[0].from).toBeDefined();
      expect(items[0].to).toBeDefined();
      expect(items[0].markerFrom).toBeDefined();
      expect(items[0].markerTo).toBeDefined();
    });

    it("extracts item text content", () => {
      const state = createTestState("- Hello World");
      const items = extractListData(state);

      expect(items[0].text).toBe("Hello World");
    });

    it("returns empty array for document with no lists", () => {
      const state = createTestState("Plain paragraph text.");
      const items = extractListData(state);

      expect(items).toHaveLength(0);
    });
  });

  describe("Bullet marker detection", () => {
    it("detects dash marker", () => {
      const state = createTestState("- Dash item");
      const items = extractListData(state);

      expect(items[0].marker).toBe("-");
    });

    it("detects asterisk marker", () => {
      const state = createTestState("* Asterisk item");
      const items = extractListData(state);

      expect(items[0].marker).toBe("*");
    });

    it("detects plus marker", () => {
      const state = createTestState("+ Plus item");
      const items = extractListData(state);

      expect(items[0].marker).toBe("+");
    });
  });

  describe("Task list checkbox detection", () => {
    it("detects unchecked checkbox with space", () => {
      const state = createTestState("- [ ] Todo");
      const items = extractListData(state);

      expect(items[0].type).toBe("task");
      expect(items[0].checked).toBe(false);
    });

    it("detects checked checkbox with lowercase x", () => {
      const state = createTestState("- [x] Done");
      const items = extractListData(state);

      expect(items[0].type).toBe("task");
      expect(items[0].checked).toBe(true);
    });

    it("detects checked checkbox with uppercase X", () => {
      const state = createTestState("- [X] Done");
      const items = extractListData(state);

      expect(items[0].type).toBe("task");
      expect(items[0].checked).toBe(true);
    });
  });

  describe("Ordered list number parsing", () => {
    it("parses single digit numbers", () => {
      const state = createTestState("1. One\n2. Two\n9. Nine");
      const items = extractListData(state);

      expect(items[0].number).toBe(1);
      expect(items[1].number).toBe(2);
      expect(items[2].number).toBe(9);
    });

    it("parses multi-digit numbers", () => {
      const state = createTestState("10. Ten\n99. Ninety-nine\n100. Hundred");
      const items = extractListData(state);

      expect(items[0].number).toBe(10);
      expect(items[1].number).toBe(99);
      expect(items[2].number).toBe(100);
    });

    it("handles non-sequential numbers", () => {
      const state = createTestState("1. First\n5. Fifth\n3. Third");
      const items = extractListData(state);

      expect(items[0].number).toBe(1);
      expect(items[1].number).toBe(5);
      expect(items[2].number).toBe(3);
    });
  });

  describe("Nested list handling", () => {
    it("correctly identifies nesting depth", () => {
      const doc = `- Level 0
  - Level 1
    - Level 2
      - Level 3`;
      const state = createTestState(doc);
      const items = extractListData(state);

      expect(items[0].indent).toBe(0);
      expect(items[1].indent).toBe(1);
      expect(items[2].indent).toBe(2);
      expect(items[3].indent).toBe(3);
    });

    it("handles mixed nested list types", () => {
      const doc = `- Bullet
  1. Ordered child
    - [ ] Task grandchild`;
      const state = createTestState(doc);
      const items = extractListData(state);

      expect(items[0].type).toBe("bullet");
      expect(items[1].type).toBe("ordered");
      expect(items[2].type).toBe("task");
    });
  });
});
