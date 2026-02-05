/**
 * Tests for link handling in CodeMirror WYSIWYG experiment
 */

import { describe, it, expect, afterEach } from "vitest";
import { createMinimalView, type TestView } from "./testUtils";
import {
  getLinkContext,
  getLinkContextAfterClosing,
  getLinkContextAtPos,
  isAtEndOfLinkText,
  isAtStartOfLinkText,
  handleBackspaceAfterLink,
  handleBackspaceAtLinkTextStart,
  handleDeleteAtLinkTextEnd,
  handleLinkCommand,
} from "../harness";

let tv: TestView;

afterEach(() => {
  tv?.destroy();
});

describe("getLinkContext", () => {
  it("returns context when cursor is in link text", () => {
    tv = createMinimalView("[he|llo](https://example.com)");
    const ctx = getLinkContext(tv.view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.text).toBe("hello");
    expect(ctx?.url).toBe("https://example.com");
  });

  it("returns context when cursor is at start of link text", () => {
    tv = createMinimalView("[|hello](https://example.com)");
    const ctx = getLinkContext(tv.view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.textFrom).toBe(1);
  });

  it("returns context when cursor is at end of link text", () => {
    tv = createMinimalView("[hello|](https://example.com)");
    const ctx = getLinkContext(tv.view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.textTo).toBe(6);
  });

  it("returns null when cursor is not in a link", () => {
    tv = createMinimalView("plain| text");
    const ctx = getLinkContext(tv.view.state);
    expect(ctx).toBeNull();
  });

  it("handles empty link text", () => {
    tv = createMinimalView("[|](https://example.com)");
    const ctx = getLinkContext(tv.view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.text).toBe("");
  });

  it("handles empty URL", () => {
    tv = createMinimalView("[he|llo]()");
    const ctx = getLinkContext(tv.view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.url).toBe("");
  });
});

describe("getLinkContextAfterClosing", () => {
  it("returns context when cursor is right after link", () => {
    tv = createMinimalView("[hello](https://example.com)| more text");
    const ctx = getLinkContextAfterClosing(tv.view.state);
    expect(ctx).not.toBeNull();
    expect(ctx?.text).toBe("hello");
  });

  it("returns null when cursor is not after a link", () => {
    tv = createMinimalView("plain| text");
    const ctx = getLinkContextAfterClosing(tv.view.state);
    expect(ctx).toBeNull();
  });
});

describe("isAtEndOfLinkText", () => {
  it("returns true when cursor is at end of link text", () => {
    tv = createMinimalView("[hello|](https://example.com)");
    const ctx = getLinkContext(tv.view.state);
    expect(ctx).not.toBeNull();
    expect(isAtEndOfLinkText(tv.view.state, ctx!)).toBe(true);
  });

  it("returns false when cursor is in middle of link text", () => {
    tv = createMinimalView("[he|llo](https://example.com)");
    const ctx = getLinkContext(tv.view.state);
    expect(ctx).not.toBeNull();
    expect(isAtEndOfLinkText(tv.view.state, ctx!)).toBe(false);
  });
});

describe("isAtStartOfLinkText", () => {
  it("returns true when cursor is at start of link text", () => {
    tv = createMinimalView("[|hello](https://example.com)");
    const ctx = getLinkContext(tv.view.state);
    expect(ctx).not.toBeNull();
    expect(isAtStartOfLinkText(tv.view.state, ctx!)).toBe(true);
  });

  it("returns false when cursor is in middle of link text", () => {
    tv = createMinimalView("[he|llo](https://example.com)");
    const ctx = getLinkContext(tv.view.state);
    expect(ctx).not.toBeNull();
    expect(isAtStartOfLinkText(tv.view.state, ctx!)).toBe(false);
  });
});

describe("handleBackspaceAfterLink", () => {
  it("deletes last char of link text when after link", () => {
    tv = createMinimalView("[hello](https://example.com)|");
    const handled = handleBackspaceAfterLink(tv.view);
    expect(handled).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("[hell](https://example.com)");
    expect(tv.view.state.selection.main.head).toBe(5);
  });

  it("deletes entire link when link text is empty", () => {
    tv = createMinimalView("[](https://example.com)|");
    const handled = handleBackspaceAfterLink(tv.view);
    expect(handled).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("");
  });
});

describe("handleBackspaceAtLinkTextStart", () => {
  it("removes link syntax but keeps text", () => {
    tv = createMinimalView("[|hello](https://example.com)");
    const handled = handleBackspaceAtLinkTextStart(tv.view);
    expect(handled).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("hello");
  });

  it("does not handle when not at start of link text", () => {
    tv = createMinimalView("[he|llo](https://example.com)");
    const handled = handleBackspaceAtLinkTextStart(tv.view);
    expect(handled).toBe(false);
  });
});

describe("handleDeleteAtLinkTextEnd", () => {
  it("skips over hidden portion and deletes next char", () => {
    tv = createMinimalView("[hello|](https://example.com) more");
    const handled = handleDeleteAtLinkTextEnd(tv.view);
    expect(handled).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("[hello](https://example.com)more");
  });
});

describe("handleLinkCommand", () => {
  it("creates empty link at cursor when no selection", () => {
    tv = createMinimalView("some |text");
    const handled = handleLinkCommand(tv.view);
    expect(handled).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("some []()text");
    expect(tv.view.state.selection.main.head).toBe(6);
  });

  it("opens editor when cursor is in existing link", () => {
    tv = createMinimalView("[he|llo](https://example.com)");
    const handled = handleLinkCommand(tv.view);
    expect(handled).toBe(true);
    expect(tv.view.state.doc.toString()).toBe("[hello](https://example.com)");
  });
});

describe("getLinkContextAtPos", () => {
  it("returns link context at a specific position", () => {
    tv = createMinimalView("|text [link](https://example.com) more");
    const ctx = getLinkContextAtPos(tv.view.state, 8);
    expect(ctx).not.toBeNull();
    expect(ctx?.text).toBe("link");
    expect(ctx?.url).toBe("https://example.com");
  });

  it("returns null when position is not in a link", () => {
    tv = createMinimalView("|text [link](https://example.com) more");
    const ctx = getLinkContextAtPos(tv.view.state, 2);
    expect(ctx).toBeNull();
  });

  it("returns context at link boundaries", () => {
    tv = createMinimalView("|[link](url)");

    const ctxStart = getLinkContextAtPos(tv.view.state, 0);
    expect(ctxStart).not.toBeNull();

    const ctxEnd = getLinkContextAtPos(tv.view.state, 11);
    expect(ctxEnd).not.toBeNull();
  });
});
