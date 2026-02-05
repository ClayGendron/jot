/**
 * Integration tests for heading handlers
 *
 * Tests cover:
 * - handleBackspaceAtHeadingStart: Remove heading markers
 */

import { describe, it, expect, afterEach } from "vitest";
import { createTestView, getDocWithCursor, type TestView } from "./testUtils";
import {
  handleBackspaceAtHeadingStart,
} from "../harness";

describe("Heading Handlers", () => {
  let testView: TestView;

  afterEach(() => {
    testView?.destroy();
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
});
