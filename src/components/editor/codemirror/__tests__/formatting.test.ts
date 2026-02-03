/**
 * Tests for Formatting Commands
 *
 * Phase 2: Verify toggle bold/italic/strikethrough/code commands
 * work correctly, adding/removing markers around selections.
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleInlineCode,
  surround,
} from "../commands/formatting";

/**
 * Helper to create an editor view for testing commands
 */
function createTestView(doc: string, selectionFrom: number, selectionTo?: number): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] })],
    selection: EditorSelection.single(selectionFrom, selectionTo ?? selectionFrom),
  });

  // Create a temporary container for the editor
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

describe("Formatting Commands", () => {
  let view: EditorView;

  afterEach(() => {
    if (view) {
      destroyView(view);
    }
  });

  describe("toggleBold", () => {
    it("adds ** markers around selected text", () => {
      view = createTestView("Hello world", 0, 5); // Select "Hello"
      toggleBold(view);

      expect(view.state.doc.toString()).toBe("**Hello** world");
    });

    it("removes ** markers from already bold text", () => {
      view = createTestView("**Hello** world", 2, 7); // Select "Hello" inside **
      toggleBold(view);

      expect(view.state.doc.toString()).toBe("Hello world");
    });

    it("handles cursor (no selection) by selecting word", () => {
      view = createTestView("Hello world", 2); // Cursor in "Hello"
      toggleBold(view);

      // Should bold the whole word
      expect(view.state.doc.toString()).toBe("**Hello** world");
    });

    it("handles selection at start of document", () => {
      view = createTestView("Hello world", 0, 5);
      toggleBold(view);

      expect(view.state.doc.toString()).toBe("**Hello** world");
    });

    it("handles selection at end of document", () => {
      view = createTestView("Hello world", 6, 11); // Select "world"
      toggleBold(view);

      expect(view.state.doc.toString()).toBe("Hello **world**");
    });

    it("handles empty selection at word boundary", () => {
      view = createTestView("Hello world", 5); // Cursor at end of "Hello"
      toggleBold(view);

      expect(view.state.doc.toString()).toBe("**Hello** world");
    });
  });

  describe("toggleItalic", () => {
    it("adds * markers around selected text", () => {
      view = createTestView("Hello world", 0, 5);
      toggleItalic(view);

      expect(view.state.doc.toString()).toBe("*Hello* world");
    });

    it("removes * markers from already italic text", () => {
      view = createTestView("*Hello* world", 1, 6);
      toggleItalic(view);

      expect(view.state.doc.toString()).toBe("Hello world");
    });

    it("handles nested formatting (italic inside bold)", () => {
      view = createTestView("**Hello world**", 2, 7); // Select "Hello" inside **
      toggleItalic(view);

      expect(view.state.doc.toString()).toBe("***Hello* world**");
    });
  });

  describe("toggleStrikethrough", () => {
    it("adds ~~ markers around selected text", () => {
      view = createTestView("Hello world", 0, 5);
      toggleStrikethrough(view);

      expect(view.state.doc.toString()).toBe("~~Hello~~ world");
    });

    it("removes ~~ markers from already strikethrough text", () => {
      view = createTestView("~~Hello~~ world", 2, 7);
      toggleStrikethrough(view);

      expect(view.state.doc.toString()).toBe("Hello world");
    });
  });

  describe("toggleInlineCode", () => {
    it("adds ` markers around selected text", () => {
      view = createTestView("Hello world", 0, 5);
      toggleInlineCode(view);

      expect(view.state.doc.toString()).toBe("`Hello` world");
    });

    it("removes ` markers from already code text", () => {
      view = createTestView("`Hello` world", 1, 6);
      toggleInlineCode(view);

      expect(view.state.doc.toString()).toBe("Hello world");
    });

    it("handles backticks in selected text", () => {
      view = createTestView("code`test", 0, 4);
      toggleInlineCode(view);

      expect(view.state.doc.toString()).toBe("`code``test");
    });
  });

  describe("surround helper", () => {
    it("wraps text with arbitrary markers", () => {
      view = createTestView("Hello world", 0, 5);
      surround(view, "==");

      expect(view.state.doc.toString()).toBe("==Hello== world");
    });

    it("removes arbitrary markers", () => {
      view = createTestView("==Hello== world", 2, 7);
      surround(view, "==");

      expect(view.state.doc.toString()).toBe("Hello world");
    });
  });

  describe("Edge cases", () => {
    it("handles empty document", () => {
      view = createTestView("", 0);
      toggleBold(view);

      // Should insert ** placeholder
      expect(view.state.doc.toString()).toBe("****");
    });

    it("handles selection spanning multiple words", () => {
      view = createTestView("Hello beautiful world", 0, 15); // "Hello beautiful"
      toggleBold(view);

      expect(view.state.doc.toString()).toBe("**Hello beautiful** world");
    });

    it("preserves surrounding content", () => {
      view = createTestView("prefix Hello suffix", 7, 12);
      toggleBold(view);

      expect(view.state.doc.toString()).toBe("prefix **Hello** suffix");
    });

    it("handles selection with leading whitespace", () => {
      view = createTestView("Hello world", 0, 6); // "Hello " with space
      toggleBold(view);

      // Should handle gracefully - exact behavior depends on implementation
      expect(view.state.doc.toString()).toMatch(/\*\*.*\*\*/);
    });

    it("maintains cursor position after toggle", () => {
      view = createTestView("Hello world", 0, 5);
      toggleBold(view);

      // Cursor should be at end of bolded text
      const selection = view.state.selection.main;
      expect(selection.anchor).toBe(2);
      expect(selection.head).toBe(7);
    });
  });
});
