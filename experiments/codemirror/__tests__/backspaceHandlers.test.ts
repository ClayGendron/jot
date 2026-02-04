/**
 * Integration tests for backspace handlers
 *
 * Tests cover:
 * - handleBackspaceAtClosingMarker: Backspace after **bold**|
 * - handleBackspaceAtParagraphStart: Merge with previous content
 */

import { describe, it, expect, afterEach } from "vitest";
import { createTestView, getDocWithCursor, type TestView } from "./testUtils";
import {
  handleBackspaceAtClosingMarker,
  handleBackspaceAtParagraphStart,
} from "../harness";

describe("Backspace Handlers", () => {
  let testView: TestView;

  afterEach(() => {
    testView?.destroy();
  });

  describe("handleBackspaceAtClosingMarker", () => {
    it("deletes last char of bold content", () => {
      testView = createTestView("**bold**|", { hidesSyntax: false });

      const handled = handleBackspaceAtClosingMarker(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("**bol|**");
    });

    it("deletes last char of italic content", () => {
      testView = createTestView("*italic*|", { hidesSyntax: false });

      const handled = handleBackspaceAtClosingMarker(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("*itali|*");
    });

    it("deletes last char of code content", () => {
      testView = createTestView("`code`|", { hidesSyntax: false });

      const handled = handleBackspaceAtClosingMarker(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("`cod|`");
    });

    it("deletes last char of strikethrough content", () => {
      testView = createTestView("~~strike~~|", { hidesSyntax: false });

      const handled = handleBackspaceAtClosingMarker(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("~~strik|~~");
    });

    it("deletes entire formatting when only one char left", () => {
      testView = createTestView("**b**|", { hidesSyntax: false });

      const handled = handleBackspaceAtClosingMarker(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("**|**");
    });

    it("deletes entire formatting when content becomes empty", () => {
      testView = createTestView("****|", { hidesSyntax: false });
      // This is actually **|** with cursor after

      const handled = handleBackspaceAtClosingMarker(testView.view);

      // Should recognize this as right after closing marker and delete entire formatting
      expect(handled).toBe(true);
    });

    it("returns false when not after closing marker", () => {
      testView = createTestView("**bo|ld**", { hidesSyntax: false });

      const handled = handleBackspaceAtClosingMarker(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false for regular text", () => {
      testView = createTestView("text|", { hidesSyntax: false });

      const handled = handleBackspaceAtClosingMarker(testView.view);

      expect(handled).toBe(false);
    });

    it("works with text after formatted content", () => {
      testView = createTestView("**bold**| more", { hidesSyntax: false });

      const handled = handleBackspaceAtClosingMarker(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("**bol|** more");
    });

    it("works with text before formatted content", () => {
      testView = createTestView("text **bold**|", { hidesSyntax: false });

      const handled = handleBackspaceAtClosingMarker(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("text **bol|**");
    });
  });

  describe("handleBackspaceAtParagraphStart", () => {
    it("merges paragraph with previous content", () => {
      testView = createTestView("Para 1\n\n|Para 2");

      const handled = handleBackspaceAtParagraphStart(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Para 1|Para 2");
    });

    it("merges paragraph with heading above", () => {
      testView = createTestView("## Heading\n\n|Paragraph");

      const handled = handleBackspaceAtParagraphStart(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("## Heading|Paragraph");
    });

    it("deletes multiple blank lines", () => {
      testView = createTestView("Para 1\n\n\n\n|Para 2");

      const handled = handleBackspaceAtParagraphStart(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Para 1|Para 2");
    });

    it("deletes all blank lines when no content above", () => {
      testView = createTestView("\n\n|Content");

      const handled = handleBackspaceAtParagraphStart(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("|Content");
    });

    it("returns false when not at start of line", () => {
      testView = createTestView("Para 1\n\nPar|a 2");

      const handled = handleBackspaceAtParagraphStart(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false on first line", () => {
      testView = createTestView("|First line");

      const handled = handleBackspaceAtParagraphStart(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false when previous line has content", () => {
      testView = createTestView("Line 1\n|Line 2");

      const handled = handleBackspaceAtParagraphStart(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false when there is a selection", () => {
      testView = createTestView("Para 1\n\nPara 2", { anchor: 8, head: 12 });

      const handled = handleBackspaceAtParagraphStart(testView.view);

      expect(handled).toBe(false);
    });
  });
});
