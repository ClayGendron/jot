/**
 * Tests for Auto-Close Markdown Extension
 *
 * Phase 2: IDE-like behavior for * and ** markers.
 * Typing * inserts paired *|*, typing another * upgrades to **|**.
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState, EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { autoCloseMarkdown, handleAsterisk, handleUnderscore } from "../extensions/autoCloseMarkdown";

/**
 * Helper to create an editor view for testing
 */
function createTestView(doc: string, cursorPos: number): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] }), autoCloseMarkdown],
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
 * Simulate typing a character
 */
function typeChar(view: EditorView, char: string): boolean {
  const pos = view.state.selection.main.head;

  if (char === "*") {
    return handleAsterisk(view);
  } else if (char === "_") {
    return handleUnderscore(view);
  }

  // Default: just insert the character
  view.dispatch({
    changes: { from: pos, insert: char },
    selection: EditorSelection.cursor(pos + 1),
  });
  return true;
}

/**
 * Cleanup helper
 */
function destroyView(view: EditorView): void {
  const parent = view.dom.parentElement;
  view.destroy();
  parent?.remove();
}

describe("Auto-Close Markdown Extension", () => {
  let view: EditorView;

  afterEach(() => {
    if (view) {
      destroyView(view);
    }
  });

  describe("Asterisk (*) handling", () => {
    it("inserts paired * when typing * in middle of text", () => {
      view = createTestView("Hello world", 5);
      const handled = typeChar(view, "*");

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("Hello** world");
      expect(view.state.selection.main.head).toBe(6); // Cursor between *|*
    });

    it("upgrades *|* to **|** when typing * between single asterisks", () => {
      view = createTestView("Hello** world", 6); // Cursor between *|*
      const handled = typeChar(view, "*");

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("Hello**** world");
      expect(view.state.selection.main.head).toBe(7); // Cursor between **|**
    });

    it("allows list marker at line start", () => {
      view = createTestView("", 0);
      const handled = typeChar(view, "*");

      // At line start, should NOT auto-close (allows list markers)
      expect(handled).toBe(false);
    });

    it("allows list marker after newline", () => {
      view = createTestView("Line 1\n", 7);
      const handled = typeChar(view, "*");

      // At line start after newline, should NOT auto-close
      expect(handled).toBe(false);
    });

    it("allows list marker after leading whitespace", () => {
      view = createTestView("  text", 2);
      const handled = typeChar(view, "*");

      // After leading whitespace, still at "line start" conceptually
      // User might want to create an indented list item
      expect(handled).toBe(false);
    });

    it("auto-closes in middle of text", () => {
      view = createTestView("some text here", 5);
      const handled = typeChar(view, "*");

      // In middle of text, auto-close (inserts ** at cursor position 5)
      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("some **text here");
    });
  });

  describe("Underscore (_) handling", () => {
    it("inserts paired _ when typing _ in middle of text", () => {
      view = createTestView("Hello world", 5);
      const handled = typeChar(view, "_");

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("Hello__ world");
      expect(view.state.selection.main.head).toBe(6);
    });

    it("upgrades _|_ to __|__ when typing _ between underscores", () => {
      view = createTestView("Hello__ world", 6);
      const handled = typeChar(view, "_");

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("Hello____ world");
      expect(view.state.selection.main.head).toBe(7);
    });
  });

  describe("Selection handling", () => {
    it("wraps selected text with * markers", () => {
      view = createTestView("Hello world", 0);
      // Select "Hello"
      view.dispatch({
        selection: EditorSelection.range(0, 5),
      });
      const handled = typeChar(view, "*");

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("*Hello* world");
    });

    it("wraps selected text with ** when typed twice", () => {
      view = createTestView("*Hello* world", 0);
      // Select "*Hello*"
      view.dispatch({
        selection: EditorSelection.range(0, 7),
      });
      const handled = typeChar(view, "*");

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("**Hello** world");
    });
  });

  describe("Edge cases", () => {
    it("handles empty document", () => {
      view = createTestView("", 0);
      // At position 0 (line start), don't auto-close
      const handled = typeChar(view, "*");
      expect(handled).toBe(false);
    });

    it("handles cursor at end of document", () => {
      view = createTestView("Hello", 5);
      const handled = typeChar(view, "*");

      expect(handled).toBe(true);
      expect(view.state.doc.toString()).toBe("Hello**");
    });

    it("does not auto-close in code blocks", () => {
      view = createTestView("```\ncode\n```", 5);
      const handled = typeChar(view, "*");

      // Inside code block, don't auto-close
      expect(handled).toBe(false);
    });

    it("does not auto-close inside existing inline code", () => {
      view = createTestView("`code here`", 5);
      const handled = typeChar(view, "*");

      // Inside inline code, don't auto-close
      expect(handled).toBe(false);
    });
  });
});
