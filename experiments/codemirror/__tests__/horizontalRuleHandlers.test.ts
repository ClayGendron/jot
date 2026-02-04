/**
 * Tests for horizontal rule handlers in the CodeMirror WYSIWYG experiment
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import {
  handleArrowDownPastHorizontalRule,
  handleArrowUpPastHorizontalRule,
  handleBackspaceAfterHorizontalRule,
  handleDeleteBeforeHorizontalRule,
  HR_REGEX,
} from "../harness";

// Helper to create a test editor view
function createView(content: string, cursorPos?: number): EditorView {
  const state = EditorState.create({
    doc: content,
    selection: cursorPos !== undefined ? { anchor: cursorPos } : undefined,
    extensions: [markdown()],
  });
  return new EditorView({ state });
}

describe("HR_REGEX", () => {
  it("matches --- horizontal rules", () => {
    expect(HR_REGEX.test("---")).toBe(true);
    expect(HR_REGEX.test("----")).toBe(true);
    expect(HR_REGEX.test("-----")).toBe(true);
  });

  it("matches *** horizontal rules", () => {
    expect(HR_REGEX.test("***")).toBe(true);
    expect(HR_REGEX.test("****")).toBe(true);
    expect(HR_REGEX.test("*****")).toBe(true);
  });

  it("matches ___ horizontal rules", () => {
    expect(HR_REGEX.test("___")).toBe(true);
    expect(HR_REGEX.test("____")).toBe(true);
    expect(HR_REGEX.test("_____")).toBe(true);
  });

  it("matches horizontal rules with trailing spaces", () => {
    expect(HR_REGEX.test("---  ")).toBe(true);
    expect(HR_REGEX.test("*** ")).toBe(true);
    expect(HR_REGEX.test("___   ")).toBe(true);
  });

  it("does not match lines with only two characters", () => {
    expect(HR_REGEX.test("--")).toBe(false);
    expect(HR_REGEX.test("**")).toBe(false);
    expect(HR_REGEX.test("__")).toBe(false);
  });

  it("does not match mixed character types", () => {
    expect(HR_REGEX.test("-*-")).toBe(false);
    expect(HR_REGEX.test("*_*")).toBe(false);
    expect(HR_REGEX.test("-_-")).toBe(false);
  });

  it("does not match text with leading content", () => {
    expect(HR_REGEX.test("text---")).toBe(false);
    expect(HR_REGEX.test(" ---")).toBe(false);
  });
});

describe("handleArrowDownPastHorizontalRule", () => {
  it("skips over horizontal rule when moving down", () => {
    const content = "Line 1\n---\nLine 3";
    const view = createView(content, 0); // Cursor at start of Line 1

    const result = handleArrowDownPastHorizontalRule(view);

    expect(result).toBe(true);
    // Should be at start of Line 3 (after the HR)
    expect(view.state.selection.main.head).toBe(11); // "Line 1\n---\n".length
  });

  it("returns false when next line is not a horizontal rule", () => {
    const content = "Line 1\nLine 2\nLine 3";
    const view = createView(content, 0);

    const result = handleArrowDownPastHorizontalRule(view);

    expect(result).toBe(false);
    // Position should be unchanged
    expect(view.state.selection.main.head).toBe(0);
  });

  it("handles HR at end of document", () => {
    const content = "Line 1\n---";
    const view = createView(content, 0);

    const result = handleArrowDownPastHorizontalRule(view);

    expect(result).toBe(true);
    // Should be at end of document
    expect(view.state.selection.main.head).toBe(content.length);
  });

  it("returns false when on last line", () => {
    const content = "Only line";
    const view = createView(content, 0);

    const result = handleArrowDownPastHorizontalRule(view);

    expect(result).toBe(false);
  });

  it("works with *** horizontal rules", () => {
    const content = "Line 1\n***\nLine 3";
    const view = createView(content, 0);

    const result = handleArrowDownPastHorizontalRule(view);

    expect(result).toBe(true);
    expect(view.state.selection.main.head).toBe(11);
  });

  it("works with ___ horizontal rules", () => {
    const content = "Line 1\n___\nLine 3";
    const view = createView(content, 0);

    const result = handleArrowDownPastHorizontalRule(view);

    expect(result).toBe(true);
    expect(view.state.selection.main.head).toBe(11);
  });
});

describe("handleArrowUpPastHorizontalRule", () => {
  it("skips over horizontal rule when moving up", () => {
    const content = "Line 1\n---\nLine 3";
    const view = createView(content, 11); // Cursor at start of Line 3

    const result = handleArrowUpPastHorizontalRule(view);

    expect(result).toBe(true);
    // Should be at end of Line 1
    expect(view.state.selection.main.head).toBe(6); // "Line 1".length
  });

  it("returns false when previous line is not a horizontal rule", () => {
    const content = "Line 1\nLine 2\nLine 3";
    const view = createView(content, 14); // Cursor at start of Line 3

    const result = handleArrowUpPastHorizontalRule(view);

    expect(result).toBe(false);
  });

  it("handles HR at start of document", () => {
    const content = "---\nLine 2";
    const view = createView(content, 4); // Cursor at start of Line 2

    const result = handleArrowUpPastHorizontalRule(view);

    expect(result).toBe(true);
    // Should be at start of document
    expect(view.state.selection.main.head).toBe(0);
  });

  it("returns false when on first line", () => {
    const content = "Only line";
    const view = createView(content, 5);

    const result = handleArrowUpPastHorizontalRule(view);

    expect(result).toBe(false);
  });
});

describe("handleBackspaceAfterHorizontalRule", () => {
  it("deletes horizontal rule when cursor is at start of line after HR", () => {
    const content = "Line 1\n---\nLine 3";
    const view = createView(content, 11); // Cursor at start of "Line 3"

    const result = handleBackspaceAfterHorizontalRule(view);

    expect(result).toBe(true);
    // HR line is deleted, but paragraph spacing is preserved
    expect(view.state.doc.toString()).toBe("Line 1\nLine 3");
  });

  it("returns false when cursor is not at start of line", () => {
    const content = "Line 1\n---\nLine 3";
    const view = createView(content, 13); // Cursor in middle of "Line 3"

    const result = handleBackspaceAfterHorizontalRule(view);

    expect(result).toBe(false);
    expect(view.state.doc.toString()).toBe(content);
  });

  it("returns false when previous line is not a horizontal rule", () => {
    const content = "Line 1\nLine 2\nLine 3";
    const view = createView(content, 14); // Cursor at start of "Line 3"

    const result = handleBackspaceAfterHorizontalRule(view);

    expect(result).toBe(false);
  });

  it("returns false when there is a selection", () => {
    const content = "Line 1\n---\nLine 3";
    const state = EditorState.create({
      doc: content,
      selection: { anchor: 11, head: 13 },
      extensions: [markdown()],
    });
    const view = new EditorView({ state });

    const result = handleBackspaceAfterHorizontalRule(view);

    expect(result).toBe(false);
  });

  it("returns false when on first line", () => {
    const content = "Line 1";
    const view = createView(content, 0);

    const result = handleBackspaceAfterHorizontalRule(view);

    expect(result).toBe(false);
  });
});

describe("handleDeleteBeforeHorizontalRule", () => {
  it("deletes horizontal rule when cursor is at end of line before HR", () => {
    const content = "Line 1\n---\nLine 3";
    const view = createView(content, 6); // Cursor at end of "Line 1"

    const result = handleDeleteBeforeHorizontalRule(view);

    expect(result).toBe(true);
    // HR and newline after it should be deleted
    expect(view.state.doc.toString()).toBe("Line 1\nLine 3");
  });

  it("returns false when cursor is not at end of line", () => {
    const content = "Line 1\n---\nLine 3";
    const view = createView(content, 3); // Cursor in middle of "Line 1"

    const result = handleDeleteBeforeHorizontalRule(view);

    expect(result).toBe(false);
    expect(view.state.doc.toString()).toBe(content);
  });

  it("returns false when next line is not a horizontal rule", () => {
    const content = "Line 1\nLine 2\nLine 3";
    const view = createView(content, 6); // Cursor at end of "Line 1"

    const result = handleDeleteBeforeHorizontalRule(view);

    expect(result).toBe(false);
  });

  it("returns false when there is a selection", () => {
    const content = "Line 1\n---\nLine 3";
    const state = EditorState.create({
      doc: content,
      selection: { anchor: 4, head: 6 },
      extensions: [markdown()],
    });
    const view = new EditorView({ state });

    const result = handleDeleteBeforeHorizontalRule(view);

    expect(result).toBe(false);
  });

  it("returns false when on last line", () => {
    const content = "Line 1";
    const view = createView(content, 6);

    const result = handleDeleteBeforeHorizontalRule(view);

    expect(result).toBe(false);
  });
});

describe("consecutive horizontal rules", () => {
  it("handles multiple HRs when navigating down - skips both from Line 1", () => {
    // When two HRs are consecutive, arrowing down from Line 1 lands on the second HR
    // because the first HR is detected and skipped to line after (which is second HR)
    const content = "Line 1\n---\n---\nLine 4";
    const view = createView(content, 0);

    // Arrow down from Line 1 skips the first HR, landing on second ---
    const result = handleArrowDownPastHorizontalRule(view);
    expect(result).toBe(true);
    expect(view.state.selection.main.head).toBe(11); // At start of second ---
  });

  it("handles multiple HRs when navigating up - skips both from Line 4", () => {
    // When two HRs are consecutive, arrowing up from Line 4 lands on the first HR
    const content = "Line 1\n---\n---\nLine 4";
    const view = createView(content, 15); // At start of Line 4

    // Arrow up from Line 4 skips second HR, landing on first ---
    const result = handleArrowUpPastHorizontalRule(view);
    expect(result).toBe(true);
    expect(view.state.selection.main.head).toBe(10); // At end of first ---
  });

  it("does not skip when current line is an HR", () => {
    // If user is somehow on an HR line, arrow handlers check NEXT/PREV line, not current
    const content = "Line 1\n---\nLine 3";
    const view = createView(content, 7); // In the middle of ---

    // Arrow down doesn't skip because we check next line (Line 3), which is not HR
    const resultDown = handleArrowDownPastHorizontalRule(view);
    expect(resultDown).toBe(false);

    // Arrow up doesn't skip because we check prev line (Line 1), which is not HR
    const resultUp = handleArrowUpPastHorizontalRule(view);
    expect(resultUp).toBe(false);
  });
});
