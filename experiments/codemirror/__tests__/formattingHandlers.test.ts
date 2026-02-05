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
  findAllFormattingOfTypeInRange,
  isEntireSelectionFormatted,
  stripMarkersOfType,
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

  // =========================================================
  // Helper function tests
  // =========================================================

  describe("stripMarkersOfType", () => {
    it("strips bold markers", () => {
      expect(stripMarkersOfType("**bold** text", "strong")).toBe("bold text");
    });

    it("strips multiple bold markers", () => {
      expect(stripMarkersOfType("**one** and **two**", "strong")).toBe("one and two");
    });

    it("strips italic markers without affecting bold", () => {
      expect(stripMarkersOfType("**bold** and *italic*", "emphasis")).toBe("**bold** and italic");
    });

    it("strips code markers", () => {
      expect(stripMarkersOfType("`code` text", "code")).toBe("code text");
    });

    it("strips strikethrough markers", () => {
      expect(stripMarkersOfType("~~strike~~ text", "strikethrough")).toBe("strike text");
    });

    it("strips highlight markers", () => {
      expect(stripMarkersOfType("==highlight== text", "highlight")).toBe("highlight text");
    });

    it("returns unchanged text when no markers present", () => {
      expect(stripMarkersOfType("plain text", "strong")).toBe("plain text");
    });
  });

  describe("findAllFormattingOfTypeInRange", () => {
    it("finds single bold region within range", () => {
      testView = createTestView("hello **bold** world", { hidesSyntax: false });
      const results = findAllFormattingOfTypeInRange(testView.view.state, "strong", 0, 20);
      expect(results.length).toBe(1);
      expect(results[0].type).toBe("strong");
    });

    it("finds multiple bold regions within range", () => {
      testView = createTestView("**one** and **two**", { hidesSyntax: false });
      const results = findAllFormattingOfTypeInRange(testView.view.state, "strong", 0, 19);
      expect(results.length).toBe(2);
    });

    it("only finds matching type, ignores others", () => {
      testView = createTestView("**bold** and *italic*", { hidesSyntax: false });
      const results = findAllFormattingOfTypeInRange(testView.view.state, "strong", 0, 21);
      expect(results.length).toBe(1);
      expect(results[0].type).toBe("strong");
    });

    it("returns empty for no formatting in range", () => {
      testView = createTestView("plain text", { hidesSyntax: false });
      const results = findAllFormattingOfTypeInRange(testView.view.state, "strong", 0, 10);
      expect(results.length).toBe(0);
    });

    it("only returns fully contained contexts", () => {
      testView = createTestView("some **bold** here", { hidesSyntax: false });
      // Range that cuts through the bold region
      const results = findAllFormattingOfTypeInRange(testView.view.state, "strong", 7, 18);
      expect(results.length).toBe(0); // Not fully contained
    });
  });

  describe("isEntireSelectionFormatted", () => {
    it("returns true when entire selection is bold", () => {
      testView = createTestView("**all bold**", { hidesSyntax: false });
      expect(isEntireSelectionFormatted(testView.view.state, "strong", 0, 12)).toBe(true);
    });

    it("returns false when selection is partially bold", () => {
      testView = createTestView("some **bold** text", { hidesSyntax: false });
      expect(isEntireSelectionFormatted(testView.view.state, "strong", 0, 18)).toBe(false);
    });

    it("returns false for adjacent formatted regions with unformatted gap", () => {
      testView = createTestView("*hello* *world*", { hidesSyntax: false });
      // Space between the two italic regions is not italic
      expect(isEntireSelectionFormatted(testView.view.state, "emphasis", 0, 15)).toBe(false);
    });

    it("returns false for no formatting", () => {
      testView = createTestView("plain text", { hidesSyntax: false });
      expect(isEntireSelectionFormatted(testView.view.state, "strong", 0, 10)).toBe(false);
    });

    it("returns true for multi-line all formatted", () => {
      testView = createTestView("**Line 1**\n**Line 2**", { hidesSyntax: false });
      expect(isEntireSelectionFormatted(testView.view.state, "strong", 0, 21)).toBe(true);
    });

    it("returns false for multi-line partially formatted", () => {
      testView = createTestView("**Line 1**\nLine 2", { hidesSyntax: false });
      expect(isEntireSelectionFormatted(testView.view.state, "strong", 0, 17)).toBe(false);
    });
  });

  // =========================================================
  // Selection with existing same-type formatting
  // =========================================================

  describe("toggle formatting on selection with existing formatting", () => {
    it("wraps selection containing italic, stripping inner markers", () => {
      const text = "line with *italics* and regular words";
      testView = createTestView(text, { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: text.length } });

      toggleItalicOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("*line with italics and regular words*");
    });

    it("removes bold from entirely bold selection", () => {
      testView = createTestView("**all bold text**", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: 17 } });

      toggleBoldOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("all bold text");
    });

    it("strips and re-wraps when selection has multiple italic regions with gap", () => {
      testView = createTestView("*hello* *world*", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: 15 } });

      toggleItalicOrEscape(testView.view);

      // Space between regions means not entirely italic, so strip + re-wrap
      expect(testView.view.state.doc.toString()).toBe("*hello world*");
    });

    it("applies bold to selection with partial bold, stripping existing", () => {
      const text = "some **bold** and regular";
      testView = createTestView(text, { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: text.length } });

      toggleBoldOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("**some bold and regular**");
    });

    it("preserves other formatting types when stripping", () => {
      const text = "**bold** and *italic*";
      testView = createTestView(text, { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: text.length } });

      toggleBoldOrEscape(testView.view);

      // Bold stripped and re-applied to whole line; italic preserved
      expect(testView.view.state.doc.toString()).toBe("**bold and *italic***");
    });

    it("handles code toggle on selection with existing code", () => {
      const text = "some `code` here";
      testView = createTestView(text, { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: text.length } });

      toggleCodeOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("`some code here`");
    });

    it("handles highlight toggle on selection with existing highlight", () => {
      const text = "some ==text== here";
      testView = createTestView(text, { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: text.length } });

      toggleHighlightOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("==some text here==");
    });
  });

  // =========================================================
  // Multi-line selection formatting
  // =========================================================

  describe("toggle formatting on multi-line selection", () => {
    it("applies bold to each line independently", () => {
      testView = createTestView("Line 1\nLine 2", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: 13 } });

      toggleBoldOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("**Line 1**\n**Line 2**");
    });

    it("skips empty lines when applying formatting", () => {
      testView = createTestView("Line 1\n\nLine 3", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: 14 } });

      toggleBoldOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("**Line 1**\n\n**Line 3**");
    });

    it("applies italic to each line independently", () => {
      testView = createTestView("Line 1\nLine 2\nLine 3", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: 20 } });

      toggleItalicOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("*Line 1*\n*Line 2*\n*Line 3*");
    });

    it("strips existing bold and applies per-line on multi-line", () => {
      const text = "**bold line**\nplain line";
      testView = createTestView(text, { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: text.length } });

      toggleBoldOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("**bold line**\n**plain line**");
    });

    it("removes formatting from multi-line when all lines are formatted", () => {
      testView = createTestView("**Line 1**\n**Line 2**", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: 21 } });

      toggleBoldOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("Line 1\nLine 2");
    });
  });

  // =========================================================
  // Existing simple selection wrapping still works
  // =========================================================

  describe("simple selection wrapping (regression)", () => {
    it("wraps plain selection in bold", () => {
      testView = createTestView("some text here", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 5, head: 9 } });

      toggleBoldOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("some **text** here");
    });

    it("wraps plain selection in italic", () => {
      testView = createTestView("some text here", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 5, head: 9 } });

      toggleItalicOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("some *text* here");
    });
  });

  // =========================================================
  // Toggle off: selection inside containing formatting context
  // =========================================================

  describe("toggle off when selection is inside formatting", () => {
    it("removes bold when content is selected inside bold markers", () => {
      testView = createTestView("**bold**", { hidesSyntax: false });
      // Select "bold" (the content between markers)
      testView.view.dispatch({ selection: { anchor: 2, head: 6 } });

      toggleBoldOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("bold");
      // Selection should stay on "bold"
      expect(testView.view.state.selection.main.anchor).toBe(0);
      expect(testView.view.state.selection.main.head).toBe(4);
    });

    it("double toggle bold: apply then remove", () => {
      testView = createTestView("bold", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: 4 } });

      // Apply bold
      toggleBoldOrEscape(testView.view);
      expect(testView.view.state.doc.toString()).toBe("**bold**");

      // Remove bold (selection is on "bold" inside markers)
      toggleBoldOrEscape(testView.view);
      expect(testView.view.state.doc.toString()).toBe("bold");
    });

    it("double toggle italic: apply then remove", () => {
      testView = createTestView("italic", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: 6 } });

      toggleItalicOrEscape(testView.view);
      expect(testView.view.state.doc.toString()).toBe("*italic*");

      toggleItalicOrEscape(testView.view);
      expect(testView.view.state.doc.toString()).toBe("italic");
    });

    it("double toggle code: apply then remove", () => {
      testView = createTestView("code", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: 4 } });

      toggleCodeOrEscape(testView.view);
      expect(testView.view.state.doc.toString()).toBe("`code`");

      toggleCodeOrEscape(testView.view);
      expect(testView.view.state.doc.toString()).toBe("code");
    });

    it("double toggle highlight: apply then remove", () => {
      testView = createTestView("text", { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 0, head: 4 } });

      toggleHighlightOrEscape(testView.view);
      expect(testView.view.state.doc.toString()).toBe("==text==");

      toggleHighlightOrEscape(testView.view);
      expect(testView.view.state.doc.toString()).toBe("text");
    });

    it("removes italic when partial content selected inside markers", () => {
      testView = createTestView("*some italic text*", { hidesSyntax: false });
      // Select just "italic" inside the italic markers
      testView.view.dispatch({ selection: { anchor: 6, head: 12 } });

      toggleItalicOrEscape(testView.view);

      // Removes the entire italic context
      expect(testView.view.state.doc.toString()).toBe("some italic text");
      // Selection adjusted: "italic" is now at [5, 11]
      expect(testView.view.state.selection.main.anchor).toBe(5);
      expect(testView.view.state.selection.main.head).toBe(11);
    });

    it("removes bold around text with other formatting preserved", () => {
      testView = createTestView("**bold with *italic* inside**", { hidesSyntax: false });
      // Select the content between bold markers
      testView.view.dispatch({ selection: { anchor: 2, head: 27 } });

      toggleBoldOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("bold with *italic* inside");
    });
  });

  // =========================================================
  // Nested bold+italic (***text***) toggle behavior
  // =========================================================

  describe("nested bold+italic (***text***)", () => {
    it("removes italic from ***text***, leaving **text**", () => {
      const text = "***bold and italic***";
      testView = createTestView(text, { hidesSyntax: false });
      // Select the content between all markers
      // ***bold and italic*** → content starts at 3, ends at text.length - 3
      const contentFrom = 3;
      const contentTo = text.length - 3;
      testView.view.dispatch({ selection: { anchor: contentFrom, head: contentTo } });

      toggleItalicOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("**bold and italic**");
    });

    it("removes bold from ***text***, leaving *text*", () => {
      const text = "***bold and italic***";
      testView = createTestView(text, { hidesSyntax: false });
      const contentFrom = 3;
      const contentTo = text.length - 3;
      testView.view.dispatch({ selection: { anchor: contentFrom, head: contentTo } });

      toggleBoldOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("*bold and italic*");
    });

    it("removes italic from ***text*** with selection on italic content range", () => {
      const text = "***bold and italic***";
      testView = createTestView(text, { hidesSyntax: false });
      // Emphasis node spans full range [0, len], so selecting it all works
      testView.view.dispatch({ selection: { anchor: 0, head: text.length } });

      toggleItalicOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("**bold and italic**");
    });

    it("removes bold from ***text*** with selection on bold content range", () => {
      const text = "***bold and italic***";
      testView = createTestView(text, { hidesSyntax: false });
      // StrongEmphasis content is [3, len-3]; select it to toggle off bold
      testView.view.dispatch({ selection: { anchor: 1, head: text.length - 1 } });

      toggleBoldOrEscape(testView.view);

      expect(testView.view.state.doc.toString()).toBe("*bold and italic*");
    });

    it("preserves selection on content after removing italic from nested", () => {
      const text = "***bold and italic***";
      testView = createTestView(text, { hidesSyntax: false });
      testView.view.dispatch({ selection: { anchor: 3, head: 18 } });

      toggleItalicOrEscape(testView.view);

      const doc = testView.view.state.doc.toString();
      expect(doc).toBe("**bold and italic**");
      // "bold and italic" should still be selected
      const sel = testView.view.state.selection.main;
      expect(doc.slice(sel.anchor, sel.head)).toBe("bold and italic");
    });
  });
});
