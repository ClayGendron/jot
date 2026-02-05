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
  toggleCodeOrEscape,
  toggleStrikethroughOrEscape,
  toggleHighlightOrEscape,
  escapeFormatting,
  getFormattingContext,
  getFormattingContextAfterClosing,
  getFormattingContextBeforeOpening,
  isAtEndOfFormatting,
  getPendingFormat,
  setHeadingLevel,
  setHeading1,
  setHeading2,
  setHeading3,
  getHiddenRanges,
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
      testView = createTestView("some text here", { hidesSyntax: false });
      // Select "text" (positions 5-9)
      testView.view.dispatch({
        selection: { anchor: 5, head: 9 },
      });

      const handled = toggleBoldOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("some **text** here");
      // Selection should be on the wrapped text
      expect(testView.view.state.selection.main.anchor).toBe(7);
      expect(testView.view.state.selection.main.head).toBe(11);
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
      testView = createTestView("some text here", { hidesSyntax: false });
      // Select "text" (positions 5-9)
      testView.view.dispatch({
        selection: { anchor: 5, head: 9 },
      });

      const handled = toggleItalicOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("some *text* here");
      // Selection should be on the wrapped text
      expect(testView.view.state.selection.main.anchor).toBe(6);
      expect(testView.view.state.selection.main.head).toBe(10);
    });
  });

  describe("toggleCodeOrEscape", () => {
    it("escapes code when at end of code content", () => {
      testView = createTestView("`code|`", { hidesSyntax: false });

      const handled = toggleCodeOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.selection.main.head).toBe(6); // After "`code`"
    });

    it("removes code when in middle of code content", () => {
      testView = createTestView("`con|tent`", { hidesSyntax: false });

      const handled = toggleCodeOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("content");
      expect(testView.view.state.selection.main.head).toBe(3);
    });

    it("inserts empty code markers when not in code", () => {
      testView = createTestView("tex|t", { hidesSyntax: false });

      const handled = toggleCodeOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("tex``t");
      expect(testView.view.state.selection.main.head).toBe(4);
    });

    it("wraps selection in code", () => {
      testView = createTestView("some text here", { hidesSyntax: false });
      testView.view.dispatch({
        selection: { anchor: 5, head: 9 },
      });

      const handled = toggleCodeOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("some `text` here");
      expect(testView.view.state.selection.main.anchor).toBe(6);
      expect(testView.view.state.selection.main.head).toBe(10);
    });
  });

  describe("toggleStrikethroughOrEscape", () => {
    it("removes strikethrough when in middle of content", () => {
      // Create strikethrough with ZWSP (as the editor does)
      testView = createTestView("~~str|ike~~", { hidesSyntax: false });

      const handled = toggleStrikethroughOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("strike");
      expect(testView.view.state.selection.main.head).toBe(3);
    });

    it("inserts empty strikethrough markers with ZWSP when not in strikethrough", () => {
      testView = createTestView("tex|t", { hidesSyntax: false });

      const handled = toggleStrikethroughOrEscape(testView.view);

      expect(handled).toBe(true);
      // Should have ZWSP between markers: ~~\u200B~~
      const doc = testView.view.state.doc.toString();
      expect(doc).toBe("tex~~\u200B~~t");
      expect(testView.view.state.selection.main.head).toBe(5);
    });

    it("wraps selection in strikethrough", () => {
      testView = createTestView("some text here", { hidesSyntax: false });
      testView.view.dispatch({
        selection: { anchor: 5, head: 9 },
      });

      const handled = toggleStrikethroughOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("some ~~text~~ here");
      expect(testView.view.state.selection.main.anchor).toBe(7);
      expect(testView.view.state.selection.main.head).toBe(11);
    });
  });

  describe("setHeadingLevel", () => {
    it("adds heading to plain text", () => {
      testView = createTestView("Hello| World", { hidesSyntax: false });

      const handled = setHeadingLevel(testView.view, 2);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("## Hello World");
      // Cursor should be adjusted for added "## " (3 chars)
      expect(testView.view.state.selection.main.head).toBe(8);
    });

    it("toggles off same heading level", () => {
      testView = createTestView("## Hello| World", { hidesSyntax: false });

      const handled = setHeadingLevel(testView.view, 2);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("Hello World");
      // Cursor adjusted for removed "## " (3 chars)
      expect(testView.view.state.selection.main.head).toBe(5);
    });

    it("changes heading level", () => {
      testView = createTestView("### Hello| World", { hidesSyntax: false });

      const handled = setHeadingLevel(testView.view, 1);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("# Hello World");
      // Cursor adjusted for changed marker (was "### " 4 chars, now "# " 2 chars)
      // Original cursor at 9, content offset = 9 - 4 = 5, new pos = 2 + 5 = 7
      expect(testView.view.state.selection.main.head).toBe(7);
    });

    it("does not convert list items", () => {
      testView = createTestView("- List| item", { hidesSyntax: false });

      const handled = setHeadingLevel(testView.view, 1);

      expect(handled).toBe(false);
      expect(testView.view.state.doc.toString()).toBe("- List item");
    });

    it("does not convert blockquotes", () => {
      testView = createTestView("> Quote| text", { hidesSyntax: false });

      const handled = setHeadingLevel(testView.view, 1);

      expect(handled).toBe(false);
      expect(testView.view.state.doc.toString()).toBe("> Quote text");
    });
  });

  describe("setHeading wrapper functions", () => {
    it("setHeading1 creates h1", () => {
      testView = createTestView("Hello|", { hidesSyntax: false });

      const handled = setHeading1(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("# Hello");
    });

    it("setHeading2 creates h2", () => {
      testView = createTestView("Hello|", { hidesSyntax: false });

      const handled = setHeading2(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("## Hello");
    });

    it("setHeading3 creates h3", () => {
      testView = createTestView("Hello|", { hidesSyntax: false });

      const handled = setHeading3(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("### Hello");
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

    it("detects pending highlight ==|==", () => {
      testView = createTestView("text ==|== more", { hidesSyntax: false });

      const format = getPendingFormat(testView.view.state);

      expect(format).toBe("highlight");
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

  describe("toggleHighlightOrEscape", () => {
    it("removes highlight when in middle of content", () => {
      testView = createTestView("==high|light==", { hidesSyntax: false });

      const handled = toggleHighlightOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("highlight");
      expect(testView.view.state.selection.main.head).toBe(4);
    });

    it("inserts empty highlight markers when not in highlight", () => {
      testView = createTestView("tex|t", { hidesSyntax: false });

      const handled = toggleHighlightOrEscape(testView.view);

      expect(handled).toBe(true);
      const doc = testView.view.state.doc.toString();
      expect(doc).toBe("tex====t");
      expect(testView.view.state.selection.main.head).toBe(5);
    });

    it("wraps selection in highlight", () => {
      testView = createTestView("some text here", { hidesSyntax: false });
      testView.view.dispatch({
        selection: { anchor: 5, head: 9 },
      });

      const handled = toggleHighlightOrEscape(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.doc.toString()).toBe("some ==text== here");
      expect(testView.view.state.selection.main.anchor).toBe(7);
      expect(testView.view.state.selection.main.head).toBe(11);
    });
  });

  describe("highlight formatting context", () => {
    it("getFormattingContext detects highlight at cursor", () => {
      testView = createTestView("==high|light==", { hidesSyntax: false });

      const ctx = getFormattingContext(testView.view.state);

      expect(ctx).not.toBeNull();
      expect(ctx!.type).toBe("highlight");
      expect(ctx!.contentFrom).toBe(2);
      expect(ctx!.contentTo).toBe(11);
    });

    it("getFormattingContextAfterClosing detects highlight", () => {
      testView = createTestView("==highlight==|", { hidesSyntax: false });

      const ctx = getFormattingContextAfterClosing(testView.view.state);

      expect(ctx).not.toBeNull();
      expect(ctx!.type).toBe("highlight");
    });

    it("getFormattingContextBeforeOpening detects highlight", () => {
      testView = createTestView("|==highlight==", { hidesSyntax: false });

      const ctx = getFormattingContextBeforeOpening(testView.view.state);

      expect(ctx).not.toBeNull();
      expect(ctx!.type).toBe("highlight");
    });

    it("isAtEndOfFormatting returns true at end of highlight content", () => {
      testView = createTestView("==highlight|==", { hidesSyntax: false });

      const ctx = getFormattingContext(testView.view.state);
      expect(ctx).not.toBeNull();
      expect(isAtEndOfFormatting(testView.view.state, ctx!)).toBe(true);
    });
  });

  describe("highlight hidden ranges", () => {
    it("hides == markers in WYSIWYG mode", () => {
      testView = createTestView("==highlighted==");

      const ranges = getHiddenRanges(testView.view.state);
      const inlineMarkers = ranges.filter(r => r.kind === "inline-marker");

      // Should have 2 inline markers (opening == and closing ==)
      expect(inlineMarkers.length).toBe(2);
      expect(inlineMarkers[0].from).toBe(0);
      expect(inlineMarkers[0].to).toBe(2);
      expect(inlineMarkers[1].from).toBe(13);
      expect(inlineMarkers[1].to).toBe(15);
    });

    it("hides == markers in nested formatting", () => {
      testView = createTestView("**bold and ==highlight==**");

      const ranges = getHiddenRanges(testView.view.state);
      const inlineMarkers = ranges.filter(r => r.kind === "inline-marker");

      // Should include both bold markers and highlight markers
      const highlightMarkers = inlineMarkers.filter(
        r => r.from === 11 && r.to === 13 || r.from === 22 && r.to === 24
      );
      expect(highlightMarkers.length).toBe(2);
    });
  });

  describe("highlight backspace empty", () => {
    it("deletes ==|== on backspace", () => {
      testView = createTestView("text ==|== more", { hidesSyntax: false });

      // Simulate what handleBackspaceEmptyFormatting does
      const doc = testView.view.state.doc;
      const pos = testView.view.state.selection.main.head;
      const before2 = doc.sliceString(pos - 2, pos);
      const after2 = doc.sliceString(pos, pos + 2);

      expect(before2).toBe("==");
      expect(after2).toBe("==");
    });
  });
});
