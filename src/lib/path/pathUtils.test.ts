/**
 * Path Utilities Tests
 *
 * Tests for cross-platform path handling.
 */

import { describe, it, expect, vi } from "vitest";
import {
  getFileName,
  getFileNameWithoutExt,
  normalizeForDisplay,
  getRelativePath,
  isAbsolutePath,
  isPathWithin,
  getExtension,
  isMarkdownFile,
  normalizeForComparisonSync,
} from "./pathUtils";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/path", () => ({
  join: vi.fn((...segments: string[]) => Promise.resolve(segments.join("/"))),
  dirname: vi.fn((path: string) => {
    const normalized = path.replace(/\\/g, "/");
    const parts = normalized.split("/");
    parts.pop();
    return Promise.resolve(parts.join("/") || "/");
  }),
  basename: vi.fn((path: string) => {
    const normalized = path.replace(/\\/g, "/");
    return Promise.resolve(normalized.split("/").pop() || path);
  }),
  normalize: vi.fn((path: string) => Promise.resolve(path)),
}));

vi.mock("@tauri-apps/plugin-os", () => ({
  platform: vi.fn(() => Promise.resolve("macos")),
}));

describe("getFileName", () => {
  it("extracts file name from Unix path", () => {
    expect(getFileName("/workspace/folder/file.md")).toBe("file.md");
  });

  it("extracts file name from Windows path", () => {
    expect(getFileName("C:\\Users\\name\\file.md")).toBe("file.md");
  });

  it("extracts file name from mixed separators", () => {
    expect(getFileName("C:\\Users/name\\folder/file.md")).toBe("file.md");
  });

  it("handles root file", () => {
    expect(getFileName("/file.md")).toBe("file.md");
  });

  it("handles file without path", () => {
    expect(getFileName("file.md")).toBe("file.md");
  });

  it("handles path ending with separator", () => {
    // normalize-path strips trailing slash, so "folder" is returned
    expect(getFileName("/folder/")).toBe("folder");
  });
});

describe("getFileNameWithoutExt", () => {
  it("removes .md extension", () => {
    expect(getFileNameWithoutExt("/path/to/note.md")).toBe("note");
  });

  it("removes other extensions", () => {
    expect(getFileNameWithoutExt("/path/to/image.png")).toBe("image");
  });

  it("handles files without extension", () => {
    expect(getFileNameWithoutExt("/path/to/README")).toBe("README");
  });

  it("handles dotfiles", () => {
    expect(getFileNameWithoutExt("/path/to/.gitignore")).toBe(".gitignore");
  });

  it("handles multiple dots", () => {
    expect(getFileNameWithoutExt("/path/to/file.test.ts")).toBe("file.test");
  });
});

describe("normalizeForDisplay", () => {
  it("converts backslashes to forward slashes", () => {
    expect(normalizeForDisplay("C:\\Users\\name\\file.md")).toBe(
      "C:/Users/name/file.md"
    );
  });

  it("preserves forward slashes", () => {
    expect(normalizeForDisplay("/Users/name/file.md")).toBe(
      "/Users/name/file.md"
    );
  });

  it("handles mixed separators", () => {
    expect(normalizeForDisplay("C:\\Users/name\\folder/file.md")).toBe(
      "C:/Users/name/folder/file.md"
    );
  });

  it("handles UNC paths", () => {
    // normalize-path converts \\ to / (single), not //
    // For UNC paths in display, this is acceptable
    expect(normalizeForDisplay("\\\\server\\share\\file.md")).toBe(
      "/server/share/file.md"
    );
  });
});

describe("getRelativePath", () => {
  it("returns relative path when target is within workspace", () => {
    expect(
      getRelativePath("/workspace", "/workspace/folder/file.md")
    ).toBe("folder/file.md");
  });

  it("handles workspace with trailing slash", () => {
    expect(
      getRelativePath("/workspace/", "/workspace/folder/file.md")
    ).toBe("folder/file.md");
  });

  it("returns empty string when target equals workspace", () => {
    expect(getRelativePath("/workspace", "/workspace")).toBe("");
  });

  it("returns full path when target is outside workspace", () => {
    expect(getRelativePath("/workspace", "/other/file.md")).toBe(
      "/other/file.md"
    );
  });

  it("handles Windows paths", () => {
    expect(
      getRelativePath("C:\\Users\\workspace", "C:\\Users\\workspace\\file.md")
    ).toBe("file.md");
  });

  it("handles root-level files", () => {
    expect(getRelativePath("/workspace", "/workspace/file.md")).toBe(
      "file.md"
    );
  });
});

describe("isAbsolutePath", () => {
  it("recognizes Unix absolute paths", () => {
    expect(isAbsolutePath("/Users/name/file.md")).toBe(true);
    expect(isAbsolutePath("/")).toBe(true);
  });

  it("recognizes Windows drive paths", () => {
    expect(isAbsolutePath("C:\\Users\\name\\file.md")).toBe(true);
    expect(isAbsolutePath("D:/folder/file.md")).toBe(true);
    expect(isAbsolutePath("c:\\lowercase.md")).toBe(true);
  });

  it("recognizes Windows UNC paths", () => {
    expect(isAbsolutePath("\\\\server\\share\\file.md")).toBe(true);
  });

  it("identifies relative paths", () => {
    expect(isAbsolutePath("folder/file.md")).toBe(false);
    expect(isAbsolutePath("./file.md")).toBe(false);
    expect(isAbsolutePath("../parent/file.md")).toBe(false);
    expect(isAbsolutePath("file.md")).toBe(false);
  });
});

describe("isPathWithin", () => {
  it("returns true for nested path", () => {
    expect(isPathWithin("/workspace/folder/file.md", "/workspace")).toBe(true);
  });

  it("returns true for same path", () => {
    expect(isPathWithin("/workspace", "/workspace")).toBe(true);
  });

  it("returns false for outside path", () => {
    expect(isPathWithin("/other/file.md", "/workspace")).toBe(false);
  });

  it("returns false for similar prefix but different path", () => {
    // /workspace2 should NOT be within /workspace
    expect(isPathWithin("/workspace2/file.md", "/workspace")).toBe(false);
  });

  it("handles Windows paths", () => {
    expect(
      isPathWithin("C:\\workspace\\folder\\file.md", "C:\\workspace")
    ).toBe(true);
    expect(isPathWithin("D:\\other\\file.md", "C:\\workspace")).toBe(false);
  });

  it("handles path traversal attempts", () => {
    // Note: isPathWithin does NOT resolve .. - it's a simple string comparison
    // Path traversal prevention should be done at the Rust/filesystem level
    // This function just checks if normalized paths match
    // The path "/workspace/../etc/passwd" starts with "/workspace" so it matches
    // Use Rust's validate_in_workspace for actual security validation
    expect(
      isPathWithin("/workspace/../etc/passwd", "/workspace")
    ).toBe(true); // String comparison, not path resolution
  });
});

describe("getExtension", () => {
  it("returns extension without dot", () => {
    expect(getExtension("/path/to/file.md")).toBe("md");
    expect(getExtension("/path/to/file.txt")).toBe("txt");
    expect(getExtension("/path/to/file.test.ts")).toBe("ts");
  });

  it("returns empty string for no extension", () => {
    expect(getExtension("/path/to/README")).toBe("");
    expect(getExtension("/path/to/.gitignore")).toBe("");
  });

  it("handles Windows paths", () => {
    expect(getExtension("C:\\Users\\file.md")).toBe("md");
  });
});

describe("isMarkdownFile", () => {
  it("returns true for .md files", () => {
    expect(isMarkdownFile("/path/to/note.md")).toBe(true);
    expect(isMarkdownFile("/path/to/note.MD")).toBe(true);
    expect(isMarkdownFile("note.md")).toBe(true);
  });

  it("returns false for non-markdown files", () => {
    expect(isMarkdownFile("/path/to/file.txt")).toBe(false);
    expect(isMarkdownFile("/path/to/file.mdx")).toBe(false);
    expect(isMarkdownFile("/path/to/README")).toBe(false);
  });
});

describe("normalizeForComparisonSync", () => {
  it("normalizes slashes and lowercases for comparison", () => {
    // Default (uncached) assumes case-insensitive
    expect(normalizeForComparisonSync("C:\\Users\\File.MD")).toBe(
      "c:/users/file.md"
    );
  });

  it("handles already-lowercase paths", () => {
    expect(normalizeForComparisonSync("/path/to/file.md")).toBe(
      "/path/to/file.md"
    );
  });

  it("normalizes mixed case paths", () => {
    expect(normalizeForComparisonSync("/Path/To/FILE.md")).toBe(
      "/path/to/file.md"
    );
  });
});
