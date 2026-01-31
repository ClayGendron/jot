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
  normalizeForComparison,
  getRelativePathStrict,
  getParentPathSync,
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
  it("returns true for nested path (case-sensitive)", () => {
    expect(isPathWithin("/workspace/folder/file.md", "/workspace", true)).toBe(true);
  });

  it("returns true for same path (case-sensitive)", () => {
    expect(isPathWithin("/workspace", "/workspace", true)).toBe(true);
  });

  it("returns false for outside path (case-sensitive)", () => {
    expect(isPathWithin("/other/file.md", "/workspace", true)).toBe(false);
  });

  it("returns false for similar prefix but different path (case-sensitive)", () => {
    // /workspace2 should NOT be within /workspace
    expect(isPathWithin("/workspace2/file.md", "/workspace", true)).toBe(false);
  });

  it("handles Windows paths (case-sensitive)", () => {
    expect(
      isPathWithin("C:\\workspace\\folder\\file.md", "C:\\workspace", true)
    ).toBe(true);
    expect(isPathWithin("D:\\other\\file.md", "C:\\workspace", true)).toBe(false);
  });

  it("handles path traversal attempts (case-sensitive)", () => {
    // Note: isPathWithin does NOT resolve .. - it's a simple string comparison
    // Path traversal prevention should be done at the Rust/filesystem level
    // This function just checks if normalized paths match
    // The path "/workspace/../etc/passwd" starts with "/workspace" so it matches
    // Use Rust's validate_in_workspace for actual security validation
    expect(
      isPathWithin("/workspace/../etc/passwd", "/workspace", true)
    ).toBe(true); // String comparison, not path resolution
  });

  it("matches case-insensitively when caseSensitive=false", () => {
    // macOS/Windows behavior
    expect(isPathWithin("/Workspace/File.md", "/workspace", false)).toBe(true);
    expect(isPathWithin("C:\\USERS\\Workspace\\file.md", "c:\\users\\workspace", false)).toBe(true);
  });

  it("requires exact case when caseSensitive=true", () => {
    // Linux behavior
    expect(isPathWithin("/Workspace/File.md", "/workspace", true)).toBe(false);
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

describe("normalizeForComparison", () => {
  it("preserves case when caseSensitive=true", () => {
    expect(normalizeForComparison("/Path/To/File.MD", true)).toBe(
      "/Path/To/File.MD"
    );
  });

  it("lowercases when caseSensitive=false", () => {
    expect(normalizeForComparison("/Path/To/File.MD", false)).toBe(
      "/path/to/file.md"
    );
  });

  it("normalizes slashes regardless of case sensitivity", () => {
    expect(normalizeForComparison("C:\\Users\\File.MD", true)).toBe(
      "C:/Users/File.MD"
    );
    expect(normalizeForComparison("C:\\Users\\File.MD", false)).toBe(
      "c:/users/file.md"
    );
  });
});

describe("getRelativePathStrict", () => {
  it("matches case-insensitively on Windows/macOS", () => {
    expect(
      getRelativePathStrict(
        "C:/Users/Workspace",
        "C:/USERS/WORKSPACE/file.md",
        false
      )
    ).toBe("file.md");
  });

  it("requires exact case match on Linux", () => {
    // When case-sensitive, /home/user/Workspace doesn't match /home/user/workspace
    expect(
      getRelativePathStrict(
        "/home/user/workspace",
        "/home/user/Workspace/file.md",
        true
      )
    ).toBe("/home/user/Workspace/file.md");
  });

  it("handles matching case on case-sensitive filesystem", () => {
    expect(
      getRelativePathStrict(
        "/home/user/workspace",
        "/home/user/workspace/folder/file.md",
        true
      )
    ).toBe("folder/file.md");
  });

  it("returns empty string when target equals workspace", () => {
    expect(
      getRelativePathStrict("/workspace", "/workspace", true)
    ).toBe("");
    expect(
      getRelativePathStrict("/workspace", "/WORKSPACE", false)
    ).toBe("");
  });

  it("preserves original case in returned path", () => {
    // Even when matching case-insensitively, the returned path keeps original case
    expect(
      getRelativePathStrict(
        "C:/Users/Workspace",
        "C:/USERS/WORKSPACE/Folder/MyFile.MD",
        false
      )
    ).toBe("Folder/MyFile.MD");
  });
});

describe("getParentPathSync", () => {
  it("returns parent directory for Unix path", () => {
    expect(getParentPathSync("/workspace/folder/file.md")).toBe(
      "/workspace/folder"
    );
  });

  it("returns parent directory for Windows path", () => {
    expect(getParentPathSync("C:\\Users\\folder\\file.md")).toBe(
      "C:/Users/folder"
    );
  });

  it("returns drive root for Windows root-level file", () => {
    expect(getParentPathSync("C:/file.md")).toBe("C:/");
    expect(getParentPathSync("C:\\file.md")).toBe("C:/");
  });

  it("returns drive root for Windows drive path", () => {
    expect(getParentPathSync("C:/")).toBe("C:/");
    expect(getParentPathSync("C:")).toBe("C:/");
  });

  it("returns root for single-level path", () => {
    // Parent of /file.md is the root /
    expect(getParentPathSync("/file.md")).toBe("/");
  });

  it("handles paths ending with separator", () => {
    expect(getParentPathSync("/workspace/folder/")).toBe(
      "/workspace"
    );
  });

  it("returns / for root-level items", () => {
    expect(getParentPathSync("/")).toBe("/");
  });
});

describe("Windows UNC paths", () => {
  it("detects UNC paths as absolute", () => {
    expect(isAbsolutePath("\\\\server\\share\\file.md")).toBe(true);
  });

  it("detects UNC paths with forward slashes", () => {
    // After normalization by other functions, UNC becomes //server/share
    // But isAbsolutePath only checks the raw input
    expect(isAbsolutePath("//server/share/file.md")).toBe(true);
  });
});

describe("Windows drive letters", () => {
  it("handles both slash styles", () => {
    expect(isAbsolutePath("C:\\Users\\file.md")).toBe(true);
    expect(isAbsolutePath("C:/Users/file.md")).toBe(true);
  });

  it("handles lowercase drive letters", () => {
    expect(isAbsolutePath("c:\\Users\\file.md")).toBe(true);
    expect(isAbsolutePath("d:/folder/file.md")).toBe(true);
  });

  it("rejects invalid drive patterns", () => {
    // No colon
    expect(isAbsolutePath("C\\Users\\file.md")).toBe(false);
    // No path after drive
    expect(isAbsolutePath("C:")).toBe(false);
    // Number instead of letter
    expect(isAbsolutePath("1:/folder/file.md")).toBe(false);
  });
});
