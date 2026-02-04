/**
 * Integration tests for enter/delete handlers
 *
 * Tests cover:
 * - handleEnter: Main Enter handler (paragraphs, lists, blockquotes, headings)
 * - handleShiftEnter: Soft line break
 * - handleDeleteAtEndOfLine: Merge with next line, remove markers
 * - handleDeleteEmptyFormatting: Delete **|**, *|*, etc.
 * - handleDeleteAtOpeningMarker: Delete at start of formatted content
 * - handleDeleteAtEndOfContent: Delete at end of formatted content
 * - handleDeleteWithSelection: Delete selected text
 */

import { describe, it, expect, afterEach } from "vitest";
import { createTestView, getDocWithCursor, setSelection, type TestView } from "./testUtils";
import {
  handleEnter,
  handleShiftEnter,
  handleDeleteAtEndOfLine,
  handleDeleteEmptyFormatting,
  handleDeleteAtOpeningMarker,
  handleDeleteAtEndOfContent,
  handleDeleteWithSelection,
} from "../harness";

describe("Enter/Delete Handlers", () => {
  let testView: TestView;

  afterEach(() => {
    testView?.destroy();
  });

  describe("handleEnter (main handler)", () => {
    it("creates paragraph break (double newline)", () => {
      testView = createTestView("Hello|");

      const handled = handleEnter(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Hello\n\n|");
    });

    it("creates paragraph break in middle of text", () => {
      testView = createTestView("Hel|lo");

      const handled = handleEnter(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Hel\n\n|lo");
    });

    it("delegates to list handler when in list", () => {
      testView = createTestView("- Item|");

      const handled = handleEnter(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("- Item\n- |");
    });

    it("delegates to blockquote handler when in blockquote", () => {
      testView = createTestView("> Quote|");

      const handled = handleEnter(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("> Quote\n> |");
    });

    it("splits heading at middle", () => {
      testView = createTestView("## Hea|ding");

      const handled = handleEnter(testView.view);

      expect(handled).toBe(true);
      // Should keep "Hea" as heading, "ding" becomes paragraph
      expect(getDocWithCursor(testView.view)).toBe("## Hea\n\n|ding");
    });

    it("inserts paragraph above heading when at content start", () => {
      testView = createTestView("## |Heading");

      const handled = handleEnter(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("\n\n## |Heading");
    });

    it("returns false when line is empty", () => {
      testView = createTestView("|");

      const handled = handleEnter(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false when there is a selection", () => {
      testView = createTestView("Hello", { anchor: 0, head: 3 });

      const handled = handleEnter(testView.view);

      expect(handled).toBe(false);
    });
  });

  describe("handleShiftEnter", () => {
    it("inserts single newline (soft break)", () => {
      testView = createTestView("Hello|");

      const handled = handleShiftEnter(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Hello\n|");
    });

    it("inserts soft break in middle of text", () => {
      testView = createTestView("Hel|lo");

      const handled = handleShiftEnter(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Hel\n|lo");
    });

    it("inserts soft break at start of line", () => {
      testView = createTestView("|Hello");

      const handled = handleShiftEnter(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("\n|Hello");
    });
  });

  describe("handleDeleteAtEndOfLine", () => {
    it("merges with blockquote, removing marker", () => {
      testView = createTestView("Para|\n\n> Quote");

      const handled = handleDeleteAtEndOfLine(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Para|Quote");
    });

    it("merges with list, removing marker", () => {
      testView = createTestView("Para|\n\n- Item");

      const handled = handleDeleteAtEndOfLine(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Para|Item");
    });

    it("merges with heading, removing marker", () => {
      testView = createTestView("Para|\n\n## Heading");

      const handled = handleDeleteAtEndOfLine(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Para|Heading");
    });

    it("skips multiple blank lines to find content", () => {
      testView = createTestView("Para|\n\n\n> Quote");

      const handled = handleDeleteAtEndOfLine(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Para|Quote");
    });

    it("returns false when not at end of line", () => {
      testView = createTestView("Par|a\n\n> Quote");

      const handled = handleDeleteAtEndOfLine(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false on last line", () => {
      testView = createTestView("Last line|");

      const handled = handleDeleteAtEndOfLine(testView.view);

      expect(handled).toBe(false);
    });

    it("merges regular paragraphs", () => {
      testView = createTestView("Para 1|\n\nPara 2");

      const handled = handleDeleteAtEndOfLine(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Para 1|Para 2");
    });
  });

  describe("handleDeleteEmptyFormatting", () => {
    it("deletes empty bold **|**", () => {
      testView = createTestView("text **|** more", { hidesSyntax: false });

      const handled = handleDeleteEmptyFormatting(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("text | more");
    });

    it("deletes empty italic *|*", () => {
      testView = createTestView("text *|* more", { hidesSyntax: false });

      const handled = handleDeleteEmptyFormatting(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("text | more");
    });

    it("deletes empty code `|`", () => {
      testView = createTestView("text `|` more", { hidesSyntax: false });

      const handled = handleDeleteEmptyFormatting(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("text | more");
    });

    it("deletes empty strikethrough ~~|~~", () => {
      testView = createTestView("text ~~|~~ more", { hidesSyntax: false });

      const handled = handleDeleteEmptyFormatting(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("text | more");
    });

    it("returns false when not in empty formatting", () => {
      testView = createTestView("text **bo|ld** more", { hidesSyntax: false });

      const handled = handleDeleteEmptyFormatting(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false for regular text", () => {
      testView = createTestView("tex|t", { hidesSyntax: false });

      const handled = handleDeleteEmptyFormatting(testView.view);

      expect(handled).toBe(false);
    });
  });

  describe("handleDeleteAtOpeningMarker", () => {
    it("deletes first char of bold content", () => {
      testView = createTestView("|**bold**", { hidesSyntax: false });

      const handled = handleDeleteAtOpeningMarker(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("**|old**");
    });

    it("deletes first char of italic content", () => {
      testView = createTestView("|*italic*", { hidesSyntax: false });

      const handled = handleDeleteAtOpeningMarker(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("*|talic*");
    });

    it("deletes first char of code content", () => {
      testView = createTestView("|`code`", { hidesSyntax: false });

      const handled = handleDeleteAtOpeningMarker(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("`|ode`");
    });

    it("deletes entire formatting when content is empty", () => {
      // Create document with empty bold ****
      testView = createTestView("|****", { hidesSyntax: false });

      const handled = handleDeleteAtOpeningMarker(testView.view);

      expect(handled).toBe(true);
      // The handler deletes the first char after opening marker
      // Since there's no content, it deletes the entire formatting
      expect(testView.view.state.doc.toString()).toBe("");
    });

    it("returns false when not at opening marker", () => {
      testView = createTestView("**bo|ld**", { hidesSyntax: false });

      const handled = handleDeleteAtOpeningMarker(testView.view);

      expect(handled).toBe(false);
    });
  });

  describe("handleDeleteAtEndOfContent", () => {
    it("skips closing marker and deletes next char", () => {
      testView = createTestView("**bold|** text", { hidesSyntax: false });

      const handled = handleDeleteAtEndOfContent(testView.view);

      expect(handled).toBe(true);
      // Should delete the space after the closing marker
      expect(getDocWithCursor(testView.view)).toBe("**bold|**text");
    });

    it("returns false when not at end of content", () => {
      testView = createTestView("**bo|ld**", { hidesSyntax: false });

      const handled = handleDeleteAtEndOfContent(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false when nothing after closing marker", () => {
      testView = createTestView("**bold|**", { hidesSyntax: false });

      const handled = handleDeleteAtEndOfContent(testView.view);

      expect(handled).toBe(false);
    });
  });

  describe("handleDeleteWithSelection", () => {
    it("expands selection to include bold markers when content fully selected", () => {
      testView = createTestView("text **bold** more", { hidesSyntax: false });
      // Select "bold" (from pos 7 to 11)
      setSelection(testView.view, 7, 11);

      const handled = handleDeleteWithSelection(testView.view);

      expect(handled).toBe(true);
      // Should delete "**bold**" entirely
      expect(testView.view.state.doc.toString()).toBe("text  more");
    });

    it("expands selection to include italic markers when content fully selected", () => {
      testView = createTestView("text *italic* more", { hidesSyntax: false });
      // Select "italic" (from pos 6 to 12)
      setSelection(testView.view, 6, 12);

      const handled = handleDeleteWithSelection(testView.view);

      expect(handled).toBe(true);
      // Should delete "*italic*" entirely
      expect(testView.view.state.doc.toString()).toBe("text  more");
    });

    it("returns false when selection is empty", () => {
      testView = createTestView("text **bo|ld** more", { hidesSyntax: false });

      const handled = handleDeleteWithSelection(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false when selection doesn't cover full content", () => {
      testView = createTestView("text **bold** more", { hidesSyntax: false });
      // Select only "bol" (partial)
      setSelection(testView.view, 7, 10);

      const handled = handleDeleteWithSelection(testView.view);

      expect(handled).toBe(false);
    });
  });
});
