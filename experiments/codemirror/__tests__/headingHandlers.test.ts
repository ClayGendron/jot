/**
 * Integration tests for heading handlers
 *
 * Tests cover:
 * - handleArrowRightIntoHeading: Skip `#` markers
 * - handleArrowLeftFromHeadingStart: Skip to previous content
 * - handleBackspaceAtHeadingStart: Remove heading markers
 * - getLineContentStart: Find where content starts
 * - getLineContentLength: Content length excluding markers
 */

import { describe, it, expect, afterEach } from "vitest";
import { createTestView, getDocWithCursor, type TestView } from "./testUtils";
import {
  handleArrowRightIntoHeading,
  handleArrowLeftFromHeadingStart,
  handleBackspaceAtHeadingStart,
  getLineContentStart,
  getLineContentLength,
} from "../harness";

describe("Heading Handlers", () => {
  let testView: TestView;

  afterEach(() => {
    testView?.destroy();
  });

  describe("handleArrowRightIntoHeading", () => {
    it("skips # marker for h1", () => {
      testView = createTestView("|# Title", { hidesSyntax: false });

      const handled = handleArrowRightIntoHeading(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.selection.main.head).toBe(2); // After "# "
    });

    it("skips ## marker for h2", () => {
      testView = createTestView("|## Title", { hidesSyntax: false });

      const handled = handleArrowRightIntoHeading(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.selection.main.head).toBe(3); // After "## "
    });

    it("skips ### marker for h3", () => {
      testView = createTestView("|### Title", { hidesSyntax: false });

      const handled = handleArrowRightIntoHeading(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.selection.main.head).toBe(4); // After "### "
    });

    it("skips all markers up to h6", () => {
      testView = createTestView("|###### Title", { hidesSyntax: false });

      const handled = handleArrowRightIntoHeading(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.selection.main.head).toBe(7); // After "###### "
    });

    it("returns false when not at line start", () => {
      testView = createTestView("# Ti|tle", { hidesSyntax: false });

      const handled = handleArrowRightIntoHeading(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false for non-heading line", () => {
      testView = createTestView("|Regular text", { hidesSyntax: false });

      const handled = handleArrowRightIntoHeading(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false for # without space (not a heading)", () => {
      testView = createTestView("|#NoSpace", { hidesSyntax: false });

      const handled = handleArrowRightIntoHeading(testView.view);

      expect(handled).toBe(false);
    });
  });

  describe("handleArrowLeftFromHeadingStart", () => {
    it("goes to end of previous line", () => {
      testView = createTestView("Previous\n## |Heading");

      const handled = handleArrowLeftFromHeadingStart(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.selection.main.head).toBe(8); // End of "Previous"
    });

    it("returns false when not at content start", () => {
      testView = createTestView("## Head|ing");

      const handled = handleArrowLeftFromHeadingStart(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false on first line", () => {
      testView = createTestView("## |Heading");

      const handled = handleArrowLeftFromHeadingStart(testView.view);

      expect(handled).toBe(false);
    });

    it("skips blank lines to find previous content", () => {
      testView = createTestView("Content\n\n## |Heading");

      const handled = handleArrowLeftFromHeadingStart(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.selection.main.head).toBe(7); // End of "Content"
    });

    it("goes to start of document if all lines above are blank", () => {
      testView = createTestView("\n\n## |Heading");

      const handled = handleArrowLeftFromHeadingStart(testView.view);

      expect(handled).toBe(true);
      expect(testView.view.state.selection.main.head).toBe(0);
    });

    it("returns false for non-heading line", () => {
      testView = createTestView("Previous\n|Regular");

      const handled = handleArrowLeftFromHeadingStart(testView.view);

      expect(handled).toBe(false);
    });
  });

  describe("handleBackspaceAtHeadingStart", () => {
    it("removes h1 marker on first line", () => {
      testView = createTestView("# |Title");

      const handled = handleBackspaceAtHeadingStart(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("|Title");
    });

    it("removes h2 marker on first line", () => {
      testView = createTestView("## |Title");

      const handled = handleBackspaceAtHeadingStart(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("|Title");
    });

    it("removes h6 marker on first line", () => {
      testView = createTestView("###### |Title");

      const handled = handleBackspaceAtHeadingStart(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("|Title");
    });

    it("merges with previous content", () => {
      testView = createTestView("Previous\n\n## |Heading");

      const handled = handleBackspaceAtHeadingStart(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Previous|Heading");
    });

    it("returns false when not at content start", () => {
      testView = createTestView("## Head|ing");

      const handled = handleBackspaceAtHeadingStart(testView.view);

      expect(handled).toBe(false);
    });

    it("returns false for non-heading line", () => {
      testView = createTestView("|Regular");

      const handled = handleBackspaceAtHeadingStart(testView.view);

      expect(handled).toBe(false);
    });

    it("handles heading on second line with content above", () => {
      testView = createTestView("Para\n## |Title");

      const handled = handleBackspaceAtHeadingStart(testView.view);

      expect(handled).toBe(true);
      expect(getDocWithCursor(testView.view)).toBe("Para|Title");
    });
  });

  describe("getLineContentStart", () => {
    it("returns position after h1 marker", () => {
      testView = createTestView("# Title|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getLineContentStart(line);

      expect(contentStart).toBe(2); // After "# "
    });

    it("returns position after h2 marker", () => {
      testView = createTestView("## Title|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getLineContentStart(line);

      expect(contentStart).toBe(3); // After "## "
    });

    it("returns position after h6 marker", () => {
      testView = createTestView("###### Title|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getLineContentStart(line);

      expect(contentStart).toBe(7); // After "###### "
    });

    it("returns line start for non-heading", () => {
      testView = createTestView("Regular text|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getLineContentStart(line);

      expect(contentStart).toBe(0);
    });

    it("returns line start for # without space", () => {
      testView = createTestView("#NoSpace|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getLineContentStart(line);

      expect(contentStart).toBe(0);
    });
  });

  describe("getLineContentLength", () => {
    it("returns content length for h1", () => {
      testView = createTestView("# Title|");
      const line = testView.view.state.doc.line(1);

      const contentLength = getLineContentLength(line);

      expect(contentLength).toBe(5); // "Title"
    });

    it("returns content length for h2", () => {
      testView = createTestView("## Heading|");
      const line = testView.view.state.doc.line(1);

      const contentLength = getLineContentLength(line);

      expect(contentLength).toBe(7); // "Heading"
    });

    it("returns full length for non-heading", () => {
      testView = createTestView("Regular text|");
      const line = testView.view.state.doc.line(1);

      const contentLength = getLineContentLength(line);

      expect(contentLength).toBe(12); // "Regular text"
    });

    it("handles empty heading content", () => {
      testView = createTestView("## |");
      const line = testView.view.state.doc.line(1);

      const contentLength = getLineContentLength(line);

      expect(contentLength).toBe(0);
    });

    it("handles heading with only spaces after marker", () => {
      testView = createTestView("##    |");
      const line = testView.view.state.doc.line(1);

      const contentLength = getLineContentLength(line);

      // The marker is "## " so content is "   " (3 spaces)
      expect(contentLength).toBe(3);
    });
  });
});
