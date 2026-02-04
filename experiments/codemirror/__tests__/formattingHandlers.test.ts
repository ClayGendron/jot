/**
 * Integration tests for formatting handlers
 *
 * Tests cover:
 * - toggleBoldOrEscape: Cmd+B behavior
 * - toggleItalicOrEscape: Cmd+I behavior
 * - escapeFormatting: Move cursor past closing marker
 * - getFormattingContext: Find bold/italic/code/strikethrough at cursor
 * - getFormattingContextAfterClosing: Find formatting just before cursor
 * - getFormattingContextBeforeOpening: Find formatting just after cursor
 * - isAtEndOfFormatting: Check if cursor at format boundary
 * - getPendingFormat: Detect **|**, *|*, etc.
 */

import { describe, it, expect, afterEach } from "vitest";
import { createTestView, type TestView } from "./testUtils";
import {
  toggleBoldOrEscape,
  toggleItalicOrEscape,
  escapeFormatting,
  getFormattingContext,
  getFormattingContextAfterClosing,
  getFormattingContextBeforeOpening,
  isAtEndOfFormatting,
  getPendingFormat,
} from "../harness";

describe("Formatting Handlers", () => {
  let testView: TestView;

  afterEach(() => {
    testView?.destroy();
  });

  describe("toggleBoldOrEscape", () => {
    it("escapes bold when at end of bold content", () => {
      testView = createTestView("**bold|**", { hidesSyntax: false });

      const handled = toggleBoldOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.selection.main.head).toBe(8); // After "**bold**"
    });

    it("removes bold when in middle of bold content", () => {
      testView = createTestView("**con|tent**", { hidesSyntax: false });

      const handled = toggleBoldOrEscape(testView.view);

      expect(handled).toBe(true);
      // Bold markers removed, content preserved
      expect(testView.view.state.doc.toString()).toBe("content");
      // Cursor position adjusted (was at offset 3 within content, stays at 3)
      expect(testView.view.state.selection.main.head).toBe(3);
    });

    it("inserts empty bold markers when not in bold", () => {
      testView = createTestView("tex|t", { hidesSyntax: false });

      const handled = toggleBoldOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("tex****t");
      // Cursor between markers
      expect(testView.view.state.selection.main.head).toBe(5);
    });

    it("wraps selection in bold", () => {
      // Select "italic" text
      testView = createTestView("*italic*", { hidesSyntax: false });
      // Manually set selection from position 1 to 7 (the word "italic")
      testView.view.dispatch({
        selection: { anchor: 1, head: 7 },
      });

      const handled = toggleBoldOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("***italic***");
    });
  });

  describe("toggleItalicOrEscape", () => {
    it("escapes italic when at end of italic content", () => {
      testView = createTestView("*italic|*", { hidesSyntax: false });

      const handled = toggleItalicOrEscape(testView.view);

      expect(handled).toBe(true);
      // Parser sees italic as 8 chars total
      expect(testView.view.state.selection.main.head).toBe(8);
    });

    it("removes italic when in middle of italic content", () => {
      testView = createTestView("*ita|lic*", { hidesSyntax: false });

      const handled = toggleItalicOrEscape(testView.view);

      expect(handled).toBe(true);
      // Italic markers removed, content preserved
      expect(testView.view.state.doc.toString()).toBe("italic");
      // Cursor position adjusted (was at offset 3 within content, stays at 3)
      expect(testView.view.state.selection.main.head).toBe(3);
    });

    it("inserts empty italic markers when not in italic", () => {
      testView = createTestView("tex|t", { hidesSyntax: false });

      const handled = toggleItalicOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("tex**t");
      // Cursor between markers
      expect(testView.view.state.selection.main.head).toBe(4);
    });

    it("wraps selection in italic", () => {
      // Select "bold" text
      testView = createTestView("**bold**", { hidesSyntax: false });
      // Manually set selection from position 2 to 6 (the word "bold")
      testView.view.dispatch({
        selection: { anchor: 2, head: 6 },
      });

      const handled = toggleItalicOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("***bold***");
    });
  });

  describe("escapeFormatting", () => {
    it("escapes bold formatting", () => {
      testView = createTestView("**bold|**", { hidesSyntax: false });

      const handled = escapeFormatting(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.selection.main.head).toBe(8);
    });

    it("escapes italic formatting", () => {
      testView = createTestView("*italic|*", { hidesSyntax: false });

      const handled = escapeFormatting(testView.view);

      expect(handled).toBe(true);
      // Parser sees italic as 8 chars total
      expect(testView.view.state.selection.main.head).toBe(8);
    });

    it("escapes code formatting", () => {
      testView = createTestView("`code|`", { hidesSyntax: false });

      const handled = escapeFormatting(testView.view);

      expect(handled).toBe(true);
      // Parser sees code as 6 chars total
      expect(testView.view.state.selection.main.head).toBe(6);
    });

    it("escapes strikethrough formatting", () => {
      testView = createTestView("~~strike|~~", { hidesSyntax: false });

      const handled = escapeFormatting(testView.view);

      expect(handled).toBe(true);
      // Parser sees strikethrough as 10 chars total
      expect(testView.view.state.selection.main.head).toBe(10);
    });

    it("returns false when not at end of formatting and far from marker", () => {
      testView = createTestView("**content in the middle|here**", { hidesSyntax: false });

      const handled = escapeFormatting(testView.view);

      // Far enough from the closing marker to return false
      expect(handled).toBe(false);
    });

    it("returns false when not in any formatting", () => {
      testView = createTestView("text|", { hidesSyntax: false });

      const handled = escapeFormatting(testView.view);

      expect(handled).toBe(false);
    });
  });

  describe("getFormattingContext", () => {
    it("detects bold formatting", () => {
      testView = createTestView("**bo|ld**", { hidesSyntax: false });

      const ctx = getFormattingContext(testView.view.state);

      expect(ctx).not.toBe(null);
      expect(ctx!.type).toBe("strong");
      expect(ctx!.from).toBe(0);
      expect(ctx!.to).toBe(8);
      expect(ctx!.contentFrom).toBe(2);
      expect(ctx!.contentTo).toBe(6);
    });

    it("detects italic formatting", () => {
      testView = createTestView("*ita|lic*", { hidesSyntax: false });

      const ctx = getFormattingContext(testView.view.state);

      expect(ctx).not.toBe(null);
      expect(ctx!.type).toBe("emphasis");
      expect(ctx!.from).toBe(0);
      // Parser sees italic as 8 chars (*italic*)
      expect(ctx!.to).toBe(8);
    });

    it("detects code formatting", () => {
      testView = createTestView("`co|de`", { hidesSyntax: false });

      const ctx = getFormattingContext(testView.view.state);

      expect(ctx).not.toBe(null);
      expect(ctx!.type).toBe("code");
    });

    it("detects strikethrough formatting", () => {
      testView = createTestView("~~str|ike~~", { hidesSyntax: false });

      const ctx = getFormattingContext(testView.view.state);

      expect(ctx).not.toBe(null);
      expect(ctx!.type).toBe("strikethrough");
    });

    it("returns null for unformatted text", () => {
      testView = createTestView("tex|t", { hidesSyntax: false });

      const ctx = getFormattingContext(testView.view.state);

      expect(ctx).toBe(null);
    });

    it("returns null when cursor is outside formatting", () => {
      testView = createTestView("**bold**| text", { hidesSyntax: false });

      const ctx = getFormattingContext(testView.view.state);

      expect(ctx).toBe(null);
    });
  });

  describe("getFormattingContextAfterClosing", () => {
    it("detects bold after closing marker", () => {
      testView = createTestView("**bold**|", { hidesSyntax: false });

      const ctx = getFormattingContextAfterClosing(testView.view.state);

      expect(ctx).not.toBe(null);
      expect(ctx!.type).toBe("strong");
    });

    it("detects italic after closing marker", () => {
      testView = createTestView("*italic*|", { hidesSyntax: false });

      const ctx = getFormattingContextAfterClosing(testView.view.state);

      expect(ctx).not.toBe(null);
      expect(ctx!.type).toBe("emphasis");
    });

    it("detects code after closing marker", () => {
      testView = createTestView("`code`|", { hidesSyntax: false });

      const ctx = getFormattingContextAfterClosing(testView.view.state);

      expect(ctx).not.toBe(null);
      expect(ctx!.type).toBe("code");
    });

    it("returns null when not after closing marker", () => {
      testView = createTestView("**bo|ld**", { hidesSyntax: false });

      const ctx = getFormattingContextAfterClosing(testView.view.state);

      expect(ctx).toBe(null);
    });

    it("returns null for regular text", () => {
      testView = createTestView("text|", { hidesSyntax: false });

      const ctx = getFormattingContextAfterClosing(testView.view.state);

      expect(ctx).toBe(null);
    });
  });

  describe("getFormattingContextBeforeOpening", () => {
    it("detects bold before opening marker", () => {
      testView = createTestView("|**bold**", { hidesSyntax: false });

      const ctx = getFormattingContextBeforeOpening(testView.view.state);

      expect(ctx).not.toBe(null);
      expect(ctx!.type).toBe("strong");
    });

    it("detects italic before opening marker", () => {
      testView = createTestView("|*italic*", { hidesSyntax: false });

      const ctx = getFormattingContextBeforeOpening(testView.view.state);

      expect(ctx).not.toBe(null);
      expect(ctx!.type).toBe("emphasis");
    });

    it("detects code before opening marker", () => {
      testView = createTestView("|`code`", { hidesSyntax: false });

      const ctx = getFormattingContextBeforeOpening(testView.view.state);

      expect(ctx).not.toBe(null);
      expect(ctx!.type).toBe("code");
    });

    it("returns null when not before opening marker", () => {
      testView = createTestView("**bo|ld**", { hidesSyntax: false });

      const ctx = getFormattingContextBeforeOpening(testView.view.state);

      expect(ctx).toBe(null);
    });

    it("returns null for regular text", () => {
      testView = createTestView("|text", { hidesSyntax: false });

      const ctx = getFormattingContextBeforeOpening(testView.view.state);

      expect(ctx).toBe(null);
    });
  });

  describe("isAtEndOfFormatting", () => {
    it("returns true at exact end of bold content", () => {
      testView = createTestView("**bold|**", { hidesSyntax: false });
      const ctx = getFormattingContext(testView.view.state);

      const result = isAtEndOfFormatting(testView.view.state, ctx!);

      expect(result).toBe(true);
    });

    it("returns true at exact end of italic content", () => {
      testView = createTestView("*italic|*", { hidesSyntax: false });
      const ctx = getFormattingContext(testView.view.state);

      const result = isAtEndOfFormatting(testView.view.state, ctx!);

      expect(result).toBe(true);
    });

    it("returns false in middle of content far from marker", () => {
      testView = createTestView("**content in |the middle**", { hidesSyntax: false });
      const ctx = getFormattingContext(testView.view.state);

      const result = isAtEndOfFormatting(testView.view.state, ctx!);

      expect(result).toBe(false);
    });

    it("returns false at start of content", () => {
      testView = createTestView("**|bold**", { hidesSyntax: false });
      const ctx = getFormattingContext(testView.view.state);

      const result = isAtEndOfFormatting(testView.view.state, ctx!);

      expect(result).toBe(false);
    });
  });

  describe("getPendingFormat", () => {
    it("detects pending bold **|**", () => {
      testView = createTestView("text **|** more", { hidesSyntax: false });

      const format = getPendingFormat(testView.view.state);

      expect(format).toBe("bold");
    });

    it("detects pending italic *|*", () => {
      testView = createTestView("text *|* more", { hidesSyntax: false });

      const format = getPendingFormat(testView.view.state);

      expect(format).toBe("italic");
    });

    it("detects pending code `|`", () => {
      testView = createTestView("text `|` more", { hidesSyntax: false });

      const format = getPendingFormat(testView.view.state);

      expect(format).toBe("code");
    });

    it("detects pending strikethrough ~~|~~", () => {
      testView = createTestView("text ~~|~~ more", { hidesSyntax: false });

      const format = getPendingFormat(testView.view.state);

      expect(format).toBe("strikethrough");
    });

    it("returns null for regular text", () => {
      testView = createTestView("tex|t", { hidesSyntax: false });

      const format = getPendingFormat(testView.view.state);

      expect(format).toBe(null);
    });

    it("returns null at start of document", () => {
      testView = createTestView("|text", { hidesSyntax: false });

      const format = getPendingFormat(testView.view.state);

      expect(format).toBe(null);
    });

    it("distinguishes bold from italic (** vs *)", () => {
      // Test that *|* is detected as italic, not misidentified
      testView = createTestView("*|*", { hidesSyntax: false });

      const format = getPendingFormat(testView.view.state);

      expect(format).toBe("italic");
    });
  });
});
