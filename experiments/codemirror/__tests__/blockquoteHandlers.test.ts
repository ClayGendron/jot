/**
 * Integration tests for blockquote handlers
 *
 * Tests cover:
 * - handleEnterInBlockquote: Continue/exit blockquote on Enter
 * - handleBackspaceInBlockquote: Remove marker on Backspace at content start
 * - getBlockquoteInfo: Parse blockquote markers
 */

import { describe, it, expect, afterEach } from "vitest";
import { createTestView, getDocWithCursor, type TestView } from "./testUtils";
import {
  handleEnterInBlockquote,
  handleBackspaceInBlockquote,
  getBlockquoteInfo,
} from "../harness";

describe("Blockquote Handlers", () => {
  let testView: TestView;

  afterEach(() => {
    testView?.destroy();
  });

  describe("handleEnterInBlockquote", () => {
    it("continues blockquote at end of non-empty line", () => {
      testView = createTestView("> Hello|");

      const handled = handleEnterInBlockquote(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("> Hello\n> |");
    });

    it("exits blockquote on empty line", () => {
      testView = createTestView("> Content\n> |");

      const handled = handleEnterInBlockquote(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("> Content\n\n|");
    });

    it("splits blockquote in middle of content", () => {
      testView = createTestView("> Hel|lo");

      const handled = handleEnterInBlockquote(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("> Hel\n> |lo");
    });

    it("returns false for non-blockquote line", () => {
      testView = createTestView("Regular text|");

      const handled = handleEnterInBlockquote(testView.view);

      expect(handled).toBe(false);
      expect(getDocWithCursor(testView.view)).toBe("Regular text|");
    });

    it("continues nested blockquote with same nesting", () => {
      testView = createTestView("> > Nested|");

      const handled = handleEnterInBlockquote(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("> > Nested\n> > |");
    });

    it("exits nested blockquote on empty nested line", () => {
      testView = createTestView("> > Content\n> > |");

      const handled = handleEnterInBlockquote(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("> > Content\n\n|");
    });

    it("inserts new line above when at content start", () => {
      testView = createTestView("> |Hello");

      const handled = handleEnterInBlockquote(testView.view);

      expect(handled).toBe(true);
      // Should insert empty blockquote line above
      expect(getDocWithCursor(testView.view)).toBe("> \n> |Hello");
    });

    it("removes marker when first line is empty", () => {
      testView = createTestView("> |");

      const handled = handleEnterInBlockquote(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("|");
    });
  });

  describe("handleBackspaceInBlockquote", () => {
    it("removes marker on empty blockquote", () => {
      testView = createTestView("> |");

      const handled = handleBackspaceInBlockquote(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("|");
    });

    it("removes marker and keeps content", () => {
      testView = createTestView("> |Hello");

      const handled = handleBackspaceInBlockquote(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("|Hello");
    });

    it("merges with previous blockquote line", () => {
      testView = createTestView("> Line 1\n> |Line 2");

      const handled = handleBackspaceInBlockquote(testView.view);

      expect(handled).toBe(true);
      // The handler inserts a space and moves cursor to end of first line
      expect(getDocWithCursor(testView.view)).toBe("> Line 1| Line 2");
    });

    it("returns false when not at content start", () => {
      testView = createTestView("> Hel|lo");

      const handled = handleBackspaceInBlockquote(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false for non-blockquote line", () => {
      testView = createTestView("|Regular text");

      const handled = handleBackspaceInBlockquote(testView.view);

      expect(handled).toBe(false);
    });

    it("merges with content above when previous line is blank", () => {
      testView = createTestView("Content above\n\n> |Quote");

      const handled = handleBackspaceInBlockquote(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Content above|Quote");
    });

    it("removes first line blockquote marker and keeps content", () => {
      testView = createTestView("> |First line content");

      const handled = handleBackspaceInBlockquote(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("|First line content");
    });
  });

  describe("getBlockquoteInfo", () => {
    it("detects simple blockquote", () => {
      testView = createTestView("> Hello|");
      const line = testView.view.state.doc.line(1);

      const info = getBlockquoteInfo(line);

      expect(info).not.toBe(null);
      expect(info!.level).toBe(1);
      expect(info!.marker).toBe("> ");
      expect(info!.contentStart).toBe(2);
    });

    it("detects nested blockquote level 2", () => {
      testView = createTestView("> > Nested|");
      const line = testView.view.state.doc.line(1);

      const info = getBlockquoteInfo(line);

      expect(info).not.toBe(null);
      expect(info!.level).toBe(2);
      expect(info!.marker).toBe("> > ");
      expect(info!.contentStart).toBe(4);
    });

    it("detects deeply nested blockquote", () => {
      testView = createTestView("> > > Deep|");
      const line = testView.view.state.doc.line(1);

      const info = getBlockquoteInfo(line);

      expect(info).not.toBe(null);
      expect(info!.level).toBe(3);
    });

    it("returns null for non-blockquote", () => {
      testView = createTestView("Regular text|");
      const line = testView.view.state.doc.line(1);

      const info = getBlockquoteInfo(line);

      expect(info).toBe(null);
    });

    it("handles blockquote with no space after marker", () => {
      testView = createTestView(">No space|");
      const line = testView.view.state.doc.line(1);

      const info = getBlockquoteInfo(line);

      expect(info).not.toBe(null);
      expect(info!.level).toBe(1);
    });

    it("handles empty blockquote", () => {
      testView = createTestView("> |");
      const line = testView.view.state.doc.line(1);

      const info = getBlockquoteInfo(line);

      expect(info).not.toBe(null);
      expect(info!.isBlockquote).toBe(true);
    });
  });
});
