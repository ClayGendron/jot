/**
 * Tests for move file functionality
 *
 * These tests verify that files can be moved between folders
 * and that internal links are correctly updated when files move.
 */

import { describe, it, expect } from "vitest";
import {
  validateMove,
  calculateNewPath,
  updateLinksForMove,
} from "./moveFile";

describe("validateMove", () => {
  const workspacePath = "/workspace";

  describe("valid moves", () => {
    it("allows moving file to different folder", () => {
      const result = validateMove(
        "/workspace/file.md",
        "/workspace/folder",
        workspacePath
      );
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("allows moving file to root", () => {
      const result = validateMove(
        "/workspace/folder/file.md",
        "/workspace",
        workspacePath
      );
      expect(result.valid).toBe(true);
    });

    it("allows moving folder to different folder", () => {
      const result = validateMove(
        "/workspace/folder-a",
        "/workspace/folder-b",
        workspacePath
      );
      expect(result.valid).toBe(true);
    });

    it("allows moving nested file to root", () => {
      const result = validateMove(
        "/workspace/a/b/c/file.md",
        "/workspace",
        workspacePath
      );
      expect(result.valid).toBe(true);
    });
  });

  describe("invalid moves", () => {
    it("rejects moving folder into itself", () => {
      const result = validateMove(
        "/workspace/folder",
        "/workspace/folder",
        workspacePath
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("into itself");
    });

    it("rejects moving folder into its descendant", () => {
      const result = validateMove(
        "/workspace/folder",
        "/workspace/folder/subfolder",
        workspacePath
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("into itself");
    });

    it("rejects moving file outside workspace", () => {
      const result = validateMove(
        "/workspace/file.md",
        "/other-location",
        workspacePath
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("outside workspace");
    });

    it("rejects moving from outside workspace", () => {
      const result = validateMove(
        "/other/file.md",
        "/workspace/folder",
        workspacePath
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("outside workspace");
    });

    it("rejects moving file to its current location", () => {
      const result = validateMove(
        "/workspace/folder/file.md",
        "/workspace/folder",
        workspacePath
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("same location");
    });
  });
});

describe("calculateNewPath", () => {
  it("calculates new path for file moved to folder", () => {
    const result = calculateNewPath(
      "/workspace/file.md",
      "/workspace/folder"
    );
    expect(result).toBe("/workspace/folder/file.md");
  });

  it("calculates new path for file moved to root", () => {
    const result = calculateNewPath(
      "/workspace/folder/file.md",
      "/workspace"
    );
    expect(result).toBe("/workspace/file.md");
  });

  it("calculates new path for nested file", () => {
    const result = calculateNewPath(
      "/workspace/a/b/file.md",
      "/workspace/x/y"
    );
    expect(result).toBe("/workspace/x/y/file.md");
  });

  it("preserves filename with spaces", () => {
    const result = calculateNewPath(
      "/workspace/my file.md",
      "/workspace/folder"
    );
    expect(result).toBe("/workspace/folder/my file.md");
  });

  it("preserves filename with special characters", () => {
    const result = calculateNewPath(
      "/workspace/file (1).md",
      "/workspace/folder"
    );
    expect(result).toBe("/workspace/folder/file (1).md");
  });
});

describe("updateLinksForMove", () => {
  describe("basic path updates", () => {
    it("updates links when file moves to subfolder", () => {
      const markdown = "See [my note](file.md) for details.";
      const result = updateLinksForMove(
        markdown,
        "file.md", // old relative path
        "folder/file.md" // new relative path
      );
      expect(result).toBe("See [my note](folder/file.md) for details.");
    });

    it("updates links when file moves to root", () => {
      const markdown = "See [my note](folder/file.md) for details.";
      const result = updateLinksForMove(markdown, "folder/file.md", "file.md");
      expect(result).toBe("See [my note](file.md) for details.");
    });

    it("updates links when file moves between folders", () => {
      const markdown = "See [my note](folder-a/file.md) for details.";
      const result = updateLinksForMove(
        markdown,
        "folder-a/file.md",
        "folder-b/file.md"
      );
      expect(result).toBe("See [my note](folder-b/file.md) for details.");
    });
  });

  describe("anchor preservation", () => {
    it("preserves anchors when moving file", () => {
      const markdown = "[Section](file.md#heading)";
      const result = updateLinksForMove(markdown, "file.md", "folder/file.md");
      expect(result).toBe("[Section](folder/file.md#heading)");
    });

    it("preserves complex anchors", () => {
      const markdown = "[Section](folder/file.md#my-complex-heading-123)";
      const result = updateLinksForMove(
        markdown,
        "folder/file.md",
        "other/file.md"
      );
      expect(result).toBe("[Section](other/file.md#my-complex-heading-123)");
    });
  });

  describe("multiple links", () => {
    it("updates all matching links", () => {
      const markdown = `[Link 1](file.md)
Some text here.
[Link 2](file.md#heading)`;
      const result = updateLinksForMove(markdown, "file.md", "folder/file.md");
      expect(result).toContain("[Link 1](folder/file.md)");
      expect(result).toContain("[Link 2](folder/file.md#heading)");
    });

    it("does not affect other links", () => {
      const markdown = `[Target](file.md)
[Other](other-file.md)`;
      const result = updateLinksForMove(markdown, "file.md", "folder/file.md");
      expect(result).toContain("[Target](folder/file.md)");
      expect(result).toContain("[Other](other-file.md)");
    });
  });

  describe("edge cases", () => {
    it("handles ./ prefix in links", () => {
      const markdown = "[Note](./file.md)";
      const result = updateLinksForMove(markdown, "file.md", "folder/file.md");
      expect(result).toBe("[Note](folder/file.md)");
    });

    it("does not update image syntax", () => {
      const markdown = "![Image](file.md)";
      const result = updateLinksForMove(markdown, "file.md", "folder/file.md");
      expect(result).toBe("![Image](file.md)");
    });

    it("handles empty content", () => {
      const result = updateLinksForMove("", "file.md", "folder/file.md");
      expect(result).toBe("");
    });

    it("returns unchanged content when no links match", () => {
      const markdown = "No links here.";
      const result = updateLinksForMove(markdown, "file.md", "folder/file.md");
      expect(result).toBe("No links here.");
    });
  });
});
