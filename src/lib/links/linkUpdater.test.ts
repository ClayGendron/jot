/**
 * Tests for link updater functionality
 *
 * These tests verify that internal links in markdown content
 * are correctly updated when files are renamed.
 */

import { describe, it, expect } from "vitest";
import { updateLinksInContent } from "./linkUpdater";

describe("updateLinksInContent", () => {
  describe("basic link updates", () => {
    it("updates simple markdown links", () => {
      const markdown = "See [my note](old-name.md) for details.";
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toBe("See [my note](new-name.md) for details.");
    });

    it("updates multiple links to same file", () => {
      const markdown = `[Link 1](old-name.md)
Some text here.
[Link 2](old-name.md)`;
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toContain("[Link 1](new-name.md)");
      expect(result).toContain("[Link 2](new-name.md)");
    });

    it("does not update non-matching links", () => {
      const markdown = "[Link](other-file.md)";
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toBe("[Link](other-file.md)");
    });

    it("does not update partial matches", () => {
      const markdown = "[Link](old-name-extended.md)";
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toBe("[Link](old-name-extended.md)");
    });
  });

  describe("anchor links", () => {
    it("preserves anchor when updating path", () => {
      const markdown = "[Section](old-name.md#heading)";
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toBe("[Section](new-name.md#heading)");
    });

    it("handles complex anchors with hyphens", () => {
      const markdown = "[Section](old-name.md#my-complex-heading-id)";
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toBe("[Section](new-name.md#my-complex-heading-id)");
    });

    it("handles anchors with numbers", () => {
      const markdown = "[Section](old-name.md#section-1-overview)";
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toBe("[Section](new-name.md#section-1-overview)");
    });
  });

  describe("paths with directories", () => {
    it("handles nested folder paths", () => {
      const markdown = "[Note](folder/old-name.md)";
      const result = updateLinksInContent(
        markdown,
        "folder/old-name.md",
        "folder/new-name.md"
      );
      expect(result).toBe("[Note](folder/new-name.md)");
    });

    it("handles deeply nested paths", () => {
      const markdown = "[Note](a/b/c/old-name.md)";
      const result = updateLinksInContent(
        markdown,
        "a/b/c/old-name.md",
        "a/b/c/new-name.md"
      );
      expect(result).toBe("[Note](a/b/c/new-name.md)");
    });

    it("handles links with ./ prefix", () => {
      const markdown = "[Note](./old-name.md)";
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toBe("[Note](new-name.md)");
    });

    it("handles links with ./ prefix and folders", () => {
      const markdown = "[Note](./folder/old-name.md)";
      const result = updateLinksInContent(
        markdown,
        "folder/old-name.md",
        "folder/new-name.md"
      );
      expect(result).toBe("[Note](folder/new-name.md)");
    });
  });

  describe("special characters", () => {
    it("handles parentheses in filename", () => {
      const markdown = "[Note](my-file (1).md)";
      const result = updateLinksInContent(
        markdown,
        "my-file (1).md",
        "my-file (2).md"
      );
      expect(result).toBe("[Note](my-file (2).md)");
    });

    it("handles spaces in filename", () => {
      const markdown = "[Note](my file.md)";
      const result = updateLinksInContent(markdown, "my file.md", "new file.md");
      expect(result).toBe("[Note](new file.md)");
    });

    // Note: Nested brackets in display text (e.g., [Note [important]])
    // are not supported - this is non-standard markdown syntax
  });

  describe("mixed content", () => {
    it("updates target links without affecting others", () => {
      const markdown = `# My Document

Link to [old note](old-name.md) and [other note](other.md).

Also see [old with anchor](old-name.md#section).`;
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toContain("[old note](new-name.md)");
      expect(result).toContain("[other note](other.md)");
      expect(result).toContain("[old with anchor](new-name.md#section)");
    });

    it("preserves markdown formatting around links", () => {
      const markdown = "**Bold [link](old-name.md)** and *italic [link](old-name.md)*";
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toBe(
        "**Bold [link](new-name.md)** and *italic [link](new-name.md)*"
      );
    });

    it("handles links in lists", () => {
      const markdown = `- Item with [link](old-name.md)
- Another item
- [Another link](old-name.md#anchor)`;
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toContain("[link](new-name.md)");
      expect(result).toContain("[Another link](new-name.md#anchor)");
    });
  });

  describe("edge cases", () => {
    it("returns unchanged content when no links match", () => {
      const markdown = "No links here, just text.";
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toBe("No links here, just text.");
    });

    it("handles empty content", () => {
      const result = updateLinksInContent("", "old-name.md", "new-name.md");
      expect(result).toBe("");
    });

    it("does not update external links", () => {
      const markdown = "[External](https://example.com/old-name.md)";
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      expect(result).toBe("[External](https://example.com/old-name.md)");
    });

    it("does not update image syntax", () => {
      const markdown = "![Image](old-name.md)";
      const result = updateLinksInContent(markdown, "old-name.md", "new-name.md");
      // Images use ![...] syntax, not [...], so they won't match
      expect(result).toBe("![Image](old-name.md)");
    });
  });
});
