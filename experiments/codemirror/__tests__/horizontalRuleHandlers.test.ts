/**
 * Tests for horizontal rule handlers in the CodeMirror WYSIWYG experiment
 */

import { describe, it, expect, afterEach } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { createMinimalView, type TestView } from "./testUtils";
import {
  handleBackspaceAfterHorizontalRule,
  handleDeleteBeforeHorizontalRule,
  HR_REGEX,
} from "../harness";

let tv: TestView;
let view: EditorView;

afterEach(() => {
  tv?.destroy();
  view?.destroy();
});

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

describe("handleBackspaceAfterHorizontalRule", () => {
  it("deletes horizontal rule when cursor is at start of line after HR", () => {
    tv = createMinimalView("Line 1\n---\n|Line 3");

    const result = handleBackspaceAfterHorizontalRule(tv.view);

    expect(result).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("Line 1\nLine 3");
  });

  it("returns false when cursor is not at start of line", () => {
    tv = createMinimalView("Line 1\n---\nLi|ne 3");

    const result = handleBackspaceAfterHorizontalRule(tv.view);

    expect(result).toBe(false);
    expect(tv.view.state.doc.toString()).toBe("Line 1\n---\nLine 3");
  });

  it("returns false when previous line is not a horizontal rule", () => {
    tv = createMinimalView("Line 1\nLine 2\n|Line 3");

    const result = handleBackspaceAfterHorizontalRule(tv.view);

    expect(result).toBe(false);
  });

  it("returns false when there is a selection", () => {
    const content = "Line 1\n---\nLine 3";
    const state = EditorState.create({
      doc: content,
      selection: { anchor: 11, head: 13 },
      extensions: [markdown()],
    });
    view = new EditorView({ state });

    const result = handleBackspaceAfterHorizontalRule(view);

    expect(result).toBe(false);
  });

  it("returns false when on first line", () => {
    tv = createMinimalView("|Line 1");

    const result = handleBackspaceAfterHorizontalRule(tv.view);

    expect(result).toBe(false);
  });
});

describe("handleDeleteBeforeHorizontalRule", () => {
  it("deletes horizontal rule when cursor is at end of line before HR", () => {
    tv = createMinimalView("Line 1|\n---\nLine 3");

    const result = handleDeleteBeforeHorizontalRule(tv.view);

    expect(result).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("Line 1\nLine 3");
  });

  it("returns false when cursor is not at end of line", () => {
    tv = createMinimalView("Lin|e 1\n---\nLine 3");

    const result = handleDeleteBeforeHorizontalRule(tv.view);

    expect(result).toBe(false);
    expect(tv.view.state.doc.toString()).toBe("Line 1\n---\nLine 3");
  });

  it("returns false when next line is not a horizontal rule", () => {
    tv = createMinimalView("Line 1|\nLine 2\nLine 3");

    const result = handleDeleteBeforeHorizontalRule(tv.view);

    expect(result).toBe(false);
  });

  it("returns false when there is a selection", () => {
    const content = "Line 1\n---\nLine 3";
    const state = EditorState.create({
      doc: content,
      selection: { anchor: 4, head: 6 },
      extensions: [markdown()],
    });
    view = new EditorView({ state });

    const result = handleDeleteBeforeHorizontalRule(view);

    expect(result).toBe(false);
  });

  it("returns false when on last line", () => {
    tv = createMinimalView("Line 1|");

    const result = handleDeleteBeforeHorizontalRule(tv.view);

    expect(result).toBe(false);
  });
});
