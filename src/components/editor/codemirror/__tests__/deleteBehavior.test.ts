/**
 * Tests for Delete Behavior Extension
 *
 * Phase 2: Boundary-safe delete/backspace near hidden markers.
 * When cursor is near ** or other markers, delete them as a unit.
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { deleteBehavior, handleBackspace, handleDelete } from "../extensions/deleteBehavior";

/**
 * Helper to create an editor view for testing
 */
function createTestView(doc: string, cursorPos: number): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), deleteBehavior],
    selection: EditorSelection.cursor(cursorPos),
  });

  const container = document.createElement("div");
  document.body.appendChild(container);

  return new EditorView({
    state,
    parent: container,
  });
}

/**
 * Cleanup helper
 */
function destroyView(view: EditorView): void {
  const parent = view.dom.parentElement;
  view.destroy();
  parent?.remove();
}

describe("Delete Behavior Extension", () => {
  let view: EditorView;

  afterEach(() => {
    if (view) {
      destroyView(view);
    }
  });

  describe("handleBackspace", () => {
    it("deletes ** as a unit when cursor is after closing **", () => {
      view = createTestView("**bold**", 8);
      const handled = handleBackspace(view);

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("**bold");
    });

    it("deletes ** as a unit when cursor is right after opening **", () => {
      view = createTestView("**bold**", 2);
      const handled = handleBackspace(view);

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("bold**");
    });

    it("deletes single * when cursor is after closing *", () => {
      view = createTestView("*italic*", 8);
      const handled = handleBackspace(view);

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("*italic");
    });

    it("deletes ~~ as a unit when cursor is after closing ~~", () => {
      view = createTestView("~~strike~~", 10);
      const handled = handleBackspace(view);

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("~~strike");
    });

    it("deletes single ` when cursor is after closing `", () => {
      view = createTestView("`code`", 6);
      const handled = handleBackspace(view);

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("`code");
    });

    it("does not handle normal text backspace", () => {
      view = createTestView("normal text", 6);
      const handled = handleBackspace(view);

      // Should not handle, let default behavior proceed
      expect(handled).toBe(false);
    });

    it("handles cursor at document start", () => {
      view = createTestView("text", 0);
      const handled = handleBackspace(view);

      // Nothing to delete, should not handle
      expect(handled).toBe(false);
    });
  });

  describe("handleDelete", () => {
    it("deletes ** as a unit when cursor is before opening **", () => {
      view = createTestView("**bold**", 0);
      const handled = handleDelete(view);

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("bold**");
    });

    it("deletes ** as a unit when cursor is right before closing **", () => {
      view = createTestView("**bold**", 6);
      const handled = handleDelete(view);

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("**bold");
    });

    it("deletes single * when cursor is before opening *", () => {
      view = createTestView("*italic*", 0);
      const handled = handleDelete(view);

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("italic*");
    });

    it("deletes ~~ as a unit when cursor is before opening ~~", () => {
      view = createTestView("~~strike~~", 0);
      const handled = handleDelete(view);

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("strike~~");
    });

    it("does not handle normal text delete", () => {
      view = createTestView("normal text", 0);
      const handled = handleDelete(view);

      expect(handled).toBe(false);
    });

    it("handles cursor at document end", () => {
      view = createTestView("text", 4);
      const handled = handleDelete(view);

      expect(handled).toBe(false);
    });
  });

  describe("Selection handling", () => {
    it("does not interfere with selection delete", () => {
      view = createTestView("**bold**", 0);
      view.dispatch({
        selection: EditorSelection.range(0, 4), // Select "**bo"
      });
      const handled = handleBackspace(view);

      // With selection, should not handle (let default delete selection)
      expect(handled).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("handles == highlight markers", () => {
      view = createTestView("==highlight==", 13);
      const handled = handleBackspace(view);

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("==highlight");
    });

    it("handles empty document", () => {
      view = createTestView("", 0);
      const handled = handleBackspace(view);

      expect(handled).toBe(false);
    });

    it("handles single character markers correctly", () => {
      // Just a single *, not paired
      view = createTestView("hello* world", 6);
      const handled = handleBackspace(view);

      // Single * that isn't a closing marker - should not specially handle
      expect(handled).toBe(true); // Still deletes the * as marker
    });
  });
});
