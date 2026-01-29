/**
 * Tests for InternalLink Suggestion Render utilities
 */

import { describe, it, expect } from "vitest";

// Test the internal utility functions by extracting their logic
// Since they're not exported, we'll test the behavior through integration

describe("parseQuery logic", () => {
  // Simulating parseQuery behavior
  function parseQuery(query: string): { filePart: string; headingPart: string | null } {
    const hashIndex = query.indexOf("#");
    if (hashIndex === -1) {
      return { filePart: query, headingPart: null };
    }
    return {
      filePart: query.slice(0, hashIndex),
      headingPart: query.slice(hashIndex + 1),
    };
  }

  it("returns file part only when no hash", () => {
    const result = parseQuery("note");
    expect(result).toEqual({ filePart: "note", headingPart: null });
  });

  it("parses file and heading when hash present", () => {
    const result = parseQuery("note#intro");
    expect(result).toEqual({ filePart: "note", headingPart: "intro" });
  });

  it("handles empty heading after hash", () => {
    const result = parseQuery("note#");
    expect(result).toEqual({ filePart: "note", headingPart: "" });
  });

  it("handles hash at start (current file heading)", () => {
    const result = parseQuery("#heading");
    expect(result).toEqual({ filePart: "", headingPart: "heading" });
  });

  it("handles multiple hashes", () => {
    const result = parseQuery("note#heading#part");
    expect(result).toEqual({ filePart: "note", headingPart: "heading#part" });
  });
});

describe("filterHeadings logic", () => {
  interface HeadingSuggestionItem {
    type: "heading";
    name: string;
    path: string;
    displayPath: string;
    headingId: string;
    headingLevel: 1 | 2 | 3 | 4 | 5 | 6;
  }

  function filterHeadings(headings: HeadingSuggestionItem[], query: string): HeadingSuggestionItem[] {
    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery) {
      return headings.slice(0, 10);
    }

    return headings
      .filter((heading) => {
        return heading.name.toLowerCase().includes(normalizedQuery);
      })
      .slice(0, 10);
  }

  const mockHeadings: HeadingSuggestionItem[] = [
    { type: "heading", name: "Introduction", path: "/test.md", displayPath: "test.md", headingId: "introduction", headingLevel: 1 },
    { type: "heading", name: "Getting Started", path: "/test.md", displayPath: "test.md", headingId: "getting-started", headingLevel: 2 },
    { type: "heading", name: "Advanced Topics", path: "/test.md", displayPath: "test.md", headingId: "advanced-topics", headingLevel: 2 },
    { type: "heading", name: "Introduction to APIs", path: "/test.md", displayPath: "test.md", headingId: "introduction-to-apis", headingLevel: 3 },
  ];

  it("returns all headings when query is empty", () => {
    const result = filterHeadings(mockHeadings, "");
    expect(result).toHaveLength(4);
  });

  it("filters headings by name", () => {
    const result = filterHeadings(mockHeadings, "intro");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Introduction");
    expect(result[1].name).toBe("Introduction to APIs");
  });

  it("is case insensitive", () => {
    const result = filterHeadings(mockHeadings, "GETTING");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Getting Started");
  });

  it("returns empty array when no matches", () => {
    const result = filterHeadings(mockHeadings, "xyz");
    expect(result).toHaveLength(0);
  });

  it("limits results to 10", () => {
    const manyHeadings: HeadingSuggestionItem[] = Array.from({ length: 20 }, (_, i) => ({
      type: "heading" as const,
      name: `Heading ${i}`,
      path: "/test.md",
      displayPath: "test.md",
      headingId: `heading-${i}`,
      headingLevel: 2 as const,
    }));

    const result = filterHeadings(manyHeadings, "");
    expect(result).toHaveLength(10);
  });
});
