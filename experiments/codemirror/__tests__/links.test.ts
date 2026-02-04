/**
 * Tests for link handling in CodeMirror WYSIWYG experiment
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  getLinkContext,
  getLinkContextAfterClosing,
  isAtEndOfLinkText,
  isAtStartOfLinkText,
  isInHiddenLinkPortion,
  handleArrowRightFromLinkText,
  handleArrowLeftAfterLink,
  handleArrowLeftFromLinkTextStart,
  handleArrowRightIntoLink,
  handleBackspaceAfterLink,
  handleBackspaceAtLinkTextStart,
  handleDeleteAtLinkTextEnd,
  handleLinkCommand,
} from "../harness";

// Helper to create an editor view with content and cursor position
function createEditorWithCursor(content: string, cursorPos: number): EditorView {
  const state = EditorState.create({
    doc: content,
    selection: { anchor: cursorPos },
    extensions: [markdown({ extensions: [GFM] })],
  });
  return new EditorView({ state });
}


describe("getLinkContext", () => {
  it("returns context when cursor is in link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 3); // Inside "hello"
    const ctx = getLinkContext(view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.text).toBe("hello");
    expect(ctx?.url).toBe("https://example.com");
    view.destroy();
  });

  it("returns context when cursor is at start of link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 1); // Right after [
    const ctx = getLinkContext(view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.textFrom).toBe(1);
    view.destroy();
  });

  it("returns context when cursor is at end of link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 6); // Right before ]
    const ctx = getLinkContext(view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.textTo).toBe(6);
    view.destroy();
  });

  it("returns null when cursor is not in a link", () => {
    const content = "plain text";
    const view = createEditorWithCursor(content, 5);
    const ctx = getLinkContext(view.state);
    expect(ctx).toBeNull();
    view.destroy();
  });

  it("handles empty link text", () => {
    const content = "[](https://example.com)";
    const view = createEditorWithCursor(content, 1); // Inside empty []
    const ctx = getLinkContext(view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.text).toBe("");
    view.destroy();
  });

  it("handles empty URL", () => {
    const content = "[hello]()";
    const view = createEditorWithCursor(content, 3);
    const ctx = getLinkContext(view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.url).toBe("");
    view.destroy();
  });
});

describe("getLinkContextAfterClosing", () => {
  it("returns context when cursor is right after link", () => {
    const content = "[hello](https://example.com) more text";
    const view = createEditorWithCursor(content, 28); // Right after )
    const ctx = getLinkContextAfterClosing(view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.text).toBe("hello");
    view.destroy();
  });

  it("returns null when cursor is not after a link", () => {
    const content = "plain text";
    const view = createEditorWithCursor(content, 5);
    const ctx = getLinkContextAfterClosing(view.state);
    expect(ctx).toBeNull();
    view.destroy();
  });
});

describe("isAtEndOfLinkText", () => {
  it("returns true when cursor is at end of link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 6);
    const ctx = getLinkContext(view.state);
    expect(ctx).not.toBeNull();
    expect(isAtEndOfLinkText(view.state, ctx!)).toBe(true);
    view.destroy();
  });

  it("returns false when cursor is in middle of link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 3);
    const ctx = getLinkContext(view.state);
    expect(ctx).not.toBeNull();
    expect(isAtEndOfLinkText(view.state, ctx!)).toBe(false);
    view.destroy();
  });
});

describe("isAtStartOfLinkText", () => {
  it("returns true when cursor is at start of link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 1);
    const ctx = getLinkContext(view.state);
    expect(ctx).not.toBeNull();
    expect(isAtStartOfLinkText(view.state, ctx!)).toBe(true);
    view.destroy();
  });

  it("returns false when cursor is in middle of link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 3);
    const ctx = getLinkContext(view.state);
    expect(ctx).not.toBeNull();
    expect(isAtStartOfLinkText(view.state, ctx!)).toBe(false);
    view.destroy();
  });
});

describe("isInHiddenLinkPortion", () => {
  it("returns true when cursor is in ](url) portion", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 10); // Inside URL
    const ctx = getLinkContext(view.state);
    expect(ctx).not.toBeNull();
    expect(isInHiddenLinkPortion(view.state, ctx!)).toBe(true);
    view.destroy();
  });

  it("returns false when cursor is in link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 3);
    const ctx = getLinkContext(view.state);
    expect(ctx).not.toBeNull();
    expect(isInHiddenLinkPortion(view.state, ctx!)).toBe(false);
    view.destroy();
  });
});

describe("handleArrowRightFromLinkText", () => {
  it("skips over ](url) when at end of link text", () => {
    const content = "[hello](https://example.com) more";
    const view = createEditorWithCursor(content, 6); // End of "hello"
    const handled = handleArrowRightFromLinkText(view);
    expect(handled).toBe(true);
    expect(view.state.selection.main.head).toBe(28); // After )
    view.destroy();
  });

  it("does not handle when not at end of link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 3); // Middle of "hello"
    const handled = handleArrowRightFromLinkText(view);
    expect(handled).toBe(false);
    view.destroy();
  });
});

describe("handleArrowLeftAfterLink", () => {
  it("skips into link text when after link", () => {
    const content = "[hello](https://example.com) more";
    const view = createEditorWithCursor(content, 28); // Right after )
    const handled = handleArrowLeftAfterLink(view);
    expect(handled).toBe(true);
    expect(view.state.selection.main.head).toBe(6); // End of "hello"
    view.destroy();
  });

  it("does not handle when not after a link", () => {
    const content = "plain text";
    const view = createEditorWithCursor(content, 5);
    const handled = handleArrowLeftAfterLink(view);
    expect(handled).toBe(false);
    view.destroy();
  });
});

describe("handleArrowLeftFromLinkTextStart", () => {
  it("skips over [ when at start of link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 1); // Right after [
    const handled = handleArrowLeftFromLinkTextStart(view);
    expect(handled).toBe(true);
    expect(view.state.selection.main.head).toBe(0); // Before [
    view.destroy();
  });

  it("does not handle when not at start of link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 3);
    const handled = handleArrowLeftFromLinkTextStart(view);
    expect(handled).toBe(false);
    view.destroy();
  });
});

describe("handleArrowRightIntoLink", () => {
  it("skips [ to enter link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 0); // Before [
    const handled = handleArrowRightIntoLink(view);
    expect(handled).toBe(true);
    expect(view.state.selection.main.head).toBe(1); // After [
    view.destroy();
  });

  it("does not handle when not before a link", () => {
    const content = "plain text";
    const view = createEditorWithCursor(content, 0);
    const handled = handleArrowRightIntoLink(view);
    expect(handled).toBe(false);
    view.destroy();
  });
});

describe("handleBackspaceAfterLink", () => {
  it("deletes last char of link text when after link", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 28); // After )
    const handled = handleBackspaceAfterLink(view);
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe("[hell](https://example.com)");
    expect(view.state.selection.main.head).toBe(5); // End of "hell"
    view.destroy();
  });

  it("deletes entire link when link text is empty", () => {
    const content = "[](https://example.com)";
    const view = createEditorWithCursor(content, 23); // After )
    const handled = handleBackspaceAfterLink(view);
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe("");
    view.destroy();
  });
});

describe("handleBackspaceAtLinkTextStart", () => {
  it("removes link syntax but keeps text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 1); // After [
    const handled = handleBackspaceAtLinkTextStart(view);
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe("hello");
    view.destroy();
  });

  it("does not handle when not at start of link text", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 3);
    const handled = handleBackspaceAtLinkTextStart(view);
    expect(handled).toBe(false);
    view.destroy();
  });
});

describe("handleDeleteAtLinkTextEnd", () => {
  it("skips over hidden portion and deletes next char", () => {
    const content = "[hello](https://example.com) more";
    const view = createEditorWithCursor(content, 6); // End of "hello"
    const handled = handleDeleteAtLinkTextEnd(view);
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe("[hello](https://example.com)more");
    view.destroy();
  });
});

describe("handleLinkCommand", () => {
  it("creates empty link at cursor when no selection", () => {
    const content = "some text";
    const view = createEditorWithCursor(content, 5);
    const handled = handleLinkCommand(view);
    expect(handled).toBe(true);
    expect(view.state.doc.toString()).toBe("some []()text");
    expect(view.state.selection.main.head).toBe(6); // Inside []
    view.destroy();
  });

  it("opens editor when cursor is in existing link", () => {
    const content = "[hello](https://example.com)";
    const view = createEditorWithCursor(content, 3);
    const handled = handleLinkCommand(view);
    expect(handled).toBe(true);
    // The editor popup is opened but content doesn't change
    expect(view.state.doc.toString()).toBe(content);
    view.destroy();
  });
});
