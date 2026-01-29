/**
 * Link resolver tests
 *
 * TDD approach: Write tests first to define expected behavior
 */

import { describe, it, expect } from "vitest";
import {
  resolveInternalLink,
  isInternalLink,
  isSameFileHeadingLink,
  parseInternalLink,
} from "./resolver";

describe("isSameFileHeadingLink", () => {
  it("returns true for heading-only links", () => {
    expect(isSameFileHeadingLink("#introduction")).toBe(true);
    expect(isSameFileHeadingLink("#getting-started")).toBe(true);
    expect(isSameFileHeadingLink("#1-overview")).toBe(true);
  });

  it("returns false for just # without heading", () => {
    expect(isSameFileHeadingLink("#")).toBe(false);
  });

  it("returns false for file links with headings", () => {
    expect(isSameFileHeadingLink("note.md#heading")).toBe(false);
    expect(isSameFileHeadingLink("docs/guide.md#intro")).toBe(false);
  });

  it("returns false for non-heading links", () => {
    expect(isSameFileHeadingLink("note.md")).toBe(false);
    expect(isSameFileHeadingLink("https://example.com")).toBe(false);
  });
});

describe("isInternalLink", () => {
  it("returns true for .md file links", () => {
    expect(isInternalLink("note.md")).toBe(true);
    expect(isInternalLink("folder/note.md")).toBe(true);
    expect(isInternalLink("./note.md")).toBe(true);
    expect(isInternalLink("../note.md")).toBe(true);
  });

  it("returns false for external links", () => {
    expect(isInternalLink("https://example.com")).toBe(false);
    expect(isInternalLink("http://example.com")).toBe(false);
    expect(isInternalLink("mailto:test@example.com")).toBe(false);
  });

  it("returns false for non-markdown files", () => {
    expect(isInternalLink("image.png")).toBe(false);
    expect(isInternalLink("document.pdf")).toBe(false);
    expect(isInternalLink("script.js")).toBe(false);
  });

  it("handles .md links with anchors", () => {
    expect(isInternalLink("note.md#heading")).toBe(true);
    expect(isInternalLink("folder/note.md#section-1")).toBe(true);
  });
});

describe("parseInternalLink", () => {
  it("parses simple filename", () => {
    const result = parseInternalLink("note.md");
    expect(result).toEqual({
      fileName: "note",
      filePath: "note.md",
      heading: undefined,
    });
  });

  it("parses filename with path", () => {
    const result = parseInternalLink("folder/subfolder/note.md");
    expect(result).toEqual({
      fileName: "note",
      filePath: "folder/subfolder/note.md",
      heading: undefined,
    });
  });

  it("parses filename with heading anchor", () => {
    const result = parseInternalLink("note.md#my-heading");
    expect(result).toEqual({
      fileName: "note",
      filePath: "note.md",
      heading: "my-heading",
    });
  });

  it("parses path with heading anchor", () => {
    const result = parseInternalLink("docs/guide.md#getting-started");
    expect(result).toEqual({
      fileName: "guide",
      filePath: "docs/guide.md",
      heading: "getting-started",
    });
  });

  it("handles relative paths", () => {
    const result = parseInternalLink("./notes/todo.md");
    expect(result).toEqual({
      fileName: "todo",
      filePath: "./notes/todo.md",
      heading: undefined,
    });
  });
});

describe("resolveInternalLink", () => {
  const mockFiles = [
    { name: "note.md", path: "/workspace/note.md" },
    { name: "todo.md", path: "/workspace/todo.md" },
    { name: "guide.md", path: "/workspace/docs/guide.md" },
    { name: "readme.md", path: "/workspace/docs/readme.md" },
    { name: "note.md", path: "/workspace/archive/note.md" }, // Duplicate name
  ];

  it("resolves simple filename to full path", () => {
    const result = resolveInternalLink("todo.md", "/workspace", mockFiles);
    expect(result.exists).toBe(true);
    expect(result.resolvedPath).toBe("/workspace/todo.md");
  });

  it("resolves path with subdirectory", () => {
    const result = resolveInternalLink("docs/guide.md", "/workspace", mockFiles);
    expect(result.exists).toBe(true);
    expect(result.resolvedPath).toBe("/workspace/docs/guide.md");
  });

  it("handles non-existent files", () => {
    const result = resolveInternalLink("missing.md", "/workspace", mockFiles);
    expect(result.exists).toBe(false);
    expect(result.resolvedPath).toBeNull();
  });

  it("preserves heading anchor in resolution", () => {
    const result = resolveInternalLink("guide.md#intro", "/workspace", mockFiles);
    expect(result.exists).toBe(true);
    expect(result.resolvedPath).toBe("/workspace/docs/guide.md");
    expect(result.heading).toBe("intro");
  });

  it("handles duplicate filenames by preferring exact path match", () => {
    // When there's an exact path match, use it
    const result = resolveInternalLink("archive/note.md", "/workspace", mockFiles);
    expect(result.exists).toBe(true);
    expect(result.resolvedPath).toBe("/workspace/archive/note.md");
  });

  it("resolves filename-only to first match when ambiguous", () => {
    // When just filename is given and multiple exist, return first match
    const result = resolveInternalLink("note.md", "/workspace", mockFiles);
    expect(result.exists).toBe(true);
    expect(result.resolvedPath).toBe("/workspace/note.md");
    expect(result.ambiguous).toBe(true);
    expect(result.alternatives).toContain("/workspace/archive/note.md");
  });

  it("handles case-insensitive matching", () => {
    const result = resolveInternalLink("TODO.md", "/workspace", mockFiles);
    expect(result.exists).toBe(true);
    expect(result.resolvedPath).toBe("/workspace/todo.md");
  });
});
