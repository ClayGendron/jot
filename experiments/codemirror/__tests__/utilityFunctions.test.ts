/**
 * Integration tests for utility functions
 *
 * Tests cover:
 * - getContentStartForLine: Find where content starts (after markers)
 */

import { describe, it, expect, afterEach } from "vitest";
import { createTestView, type TestView } from "./testUtils";
import { getContentStartForLine } from "../harness";

describe("Utility Functions", () => {
  let testView: TestView;

  afterEach(() => {
    testView?.destroy();
  });

  describe("getContentStartForLine", () => {
    it("returns position after heading marker", () => {
      testView = createTestView("## Heading|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(3); // After "## "
    });

    it("returns position after h1 marker", () => {
      testView = createTestView("# Title|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(2); // After "# "
    });

    it("returns position after h6 marker", () => {
      testView = createTestView("###### Deep|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(7); // After "###### "
    });

    it("returns position after blockquote marker", () => {
      testView = createTestView("> Quote|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(2); // After "> "
    });

    it("returns position after nested blockquote markers", () => {
      testView = createTestView("> > Nested|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(4); // After "> > "
    });

    it("returns position after list marker -", () => {
      testView = createTestView("- Item|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(2); // After "- "
    });

    it("returns position after list marker *", () => {
      testView = createTestView("* Item|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(2); // After "* "
    });

    it("returns position after ordered list marker", () => {
      testView = createTestView("1. Item|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(3); // After "1. "
    });

    it("returns position after indented list marker", () => {
      testView = createTestView("  - Nested|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(4); // After "  - "
    });

    it("returns line start for plain paragraph", () => {
      testView = createTestView("Plain text|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(0); // No marker, starts at line beginning
    });

    it("returns line start for # without space (not a heading)", () => {
      testView = createTestView("#NoSpace|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(0); // Not a heading, starts at line beginning
    });

    it("handles empty line", () => {
      testView = createTestView("|");
      const line = testView.view.state.doc.line(1);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(0);
    });

    it("handles second line correctly", () => {
      testView = createTestView("First\n## Second|");
      const line = testView.view.state.doc.line(2);

      const contentStart = getContentStartForLine(line);

      expect(contentStart).toBe(9); // Line starts at 6, + "## " = 9
    });

    it("handles multiple lines with different markers", () => {
      testView = createTestView("# H1\n## H2\n- List|");

      const line1 = testView.view.state.doc.line(1);
      const line2 = testView.view.state.doc.line(2);
      const line3 = testView.view.state.doc.line(3);

      expect(getContentStartForLine(line1)).toBe(2); // After "# "
      expect(getContentStartForLine(line2)).toBe(8); // Line at 5, + "## " = 8
      // Line 3 starts at position 11 (# H1\n## H2\n = 5+6=11), + "- " = 13
      expect(getContentStartForLine(line3)).toBe(13);
    });
  });
});
