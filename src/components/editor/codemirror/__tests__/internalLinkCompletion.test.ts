/**
 * Tests for Internal Link Autocomplete
 *
 * Phase 4: Verify [[ triggers autocomplete, suggestions are filtered,
 * and correct markdown links are inserted.
 */

import { describe, it, expect, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import {
  createInternalLinkCompletionSource,
  type InternalLinkCompletionOptions,
} from "../extensions/internalLinkCompletion";
import type { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

/**
 * Helper to create a mock CompletionContext
 */
function createMockContext(doc: string, pos: number): CompletionContext {
  const state = EditorState.create({
    doc,
    extensions: [markdown({ extensions: [GFM] })],
  });

  return {
    state,
    pos,
    explicit: false,
    view: null as unknown as CompletionContext["view"],
    aborted: false,
    addEventListener: vi.fn(),
    tokenBefore: vi.fn(),
    matchBefore: vi.fn(),
  } as unknown as CompletionContext;
}

/**
 * Helper to call completion source and get synchronous result
 * Our implementation always returns synchronously
 */
function getResult(
  source: ReturnType<typeof createInternalLinkCompletionSource>,
  context: CompletionContext
): CompletionResult | null {
  const result = source(context);
  // Our implementation is synchronous, so we can safely cast
  return result as CompletionResult | null;
}

describe("Internal Link Completion", () => {
  describe("createInternalLinkCompletionSource", () => {
    const mockFiles = [
      { name: "notes.md", path: "/workspace/notes.md", displayPath: "notes.md" },
      { name: "getting-started.md", path: "/workspace/docs/getting-started.md", displayPath: "docs/getting-started.md" },
      { name: "API.md", path: "/workspace/docs/API.md", displayPath: "docs/API.md" },
    ];

    const defaultOptions: InternalLinkCompletionOptions = {
      getFileSuggestions: () => mockFiles,
    };

    it("returns null when no [[ trigger found", () => {
      const source = createInternalLinkCompletionSource(defaultOptions);
      const context = createMockContext("Just text", 9);

      const result = getResult(source, context);

      expect(result).toBeNull();
    });

    it("returns completions when [[ is found", () => {
      const source = createInternalLinkCompletionSource(defaultOptions);
      const context = createMockContext("[[", 2);

      const result = getResult(source, context);

      expect(result).not.toBeNull();
      expect(result?.options.length).toBeGreaterThan(0);
    });

    it("filters completions by query", () => {
      const source = createInternalLinkCompletionSource(defaultOptions);
      const context = createMockContext("[[notes", 7);

      const result = getResult(source, context);

      expect(result).not.toBeNull();
      expect(result?.options.some((o) => o.label === "notes")).toBe(true);
    });

    it("returns null when [[ is inside code block", () => {
      const source = createInternalLinkCompletionSource(defaultOptions);
      const context = createMockContext("```\n[[\n```", 5);

      const result = getResult(source, context);

      expect(result).toBeNull();
    });

    it("returns null when [[ is escaped", () => {
      const source = createInternalLinkCompletionSource(defaultOptions);
      const context = createMockContext("\\[[text", 7);

      const result = getResult(source, context);

      expect(result).toBeNull();
    });

    it("returns null when [[ is already closed with ]]", () => {
      const source = createInternalLinkCompletionSource(defaultOptions);
      const context = createMockContext("[[link]] more", 13);

      const result = getResult(source, context);

      expect(result).toBeNull();
    });

    it("includes file suggestions in completions", () => {
      const source = createInternalLinkCompletionSource(defaultOptions);
      const context = createMockContext("[[", 2);

      const result = getResult(source, context);

      expect(result).not.toBeNull();
      const labels = result?.options.map((o) => o.label);
      expect(labels).toContain("notes");
      expect(labels).toContain("getting-started");
      expect(labels).toContain("API");
    });

    it("filters by partial match", () => {
      const source = createInternalLinkCompletionSource(defaultOptions);
      const context = createMockContext("[[get", 5);

      const result = getResult(source, context);

      expect(result).not.toBeNull();
      expect(result?.options.some((o) => o.label === "getting-started")).toBe(true);
      expect(result?.options.some((o) => o.label === "notes")).toBe(false);
    });

    it("case-insensitive filtering", () => {
      const source = createInternalLinkCompletionSource(defaultOptions);
      const context = createMockContext("[[API", 5);

      const result = getResult(source, context);

      expect(result).not.toBeNull();
      expect(result?.options.some((o) => o.label === "API")).toBe(true);

      const context2 = createMockContext("[[api", 5);
      const result2 = getResult(source, context2);

      expect(result2).not.toBeNull();
      expect(result2?.options.some((o) => o.label === "API")).toBe(true);
    });

    it("limits results to 10", () => {
      const manyFiles = Array.from({ length: 20 }, (_, i) => ({
        name: `file${i}.md`,
        path: `/workspace/file${i}.md`,
        displayPath: `file${i}.md`,
      }));

      const source = createInternalLinkCompletionSource({
        getFileSuggestions: () => manyFiles,
      });
      const context = createMockContext("[[", 2);

      const result = getResult(source, context);

      expect(result).not.toBeNull();
      expect(result?.options.length).toBeLessThanOrEqual(10);
    });

    it("returns null when no suggestions match query", () => {
      const source = createInternalLinkCompletionSource(defaultOptions);
      const context = createMockContext("[[nonexistent", 13);

      const result = getResult(source, context);

      expect(result).toBeNull();
    });
  });

  describe("Trigger detection", () => {
    const mockOptions: InternalLinkCompletionOptions = {
      getFileSuggestions: () => [
        { name: "test.md", path: "/test.md", displayPath: "test.md" },
      ],
    };

    it("detects [[ at start of line", () => {
      const source = createInternalLinkCompletionSource(mockOptions);
      const context = createMockContext("[[test", 6);

      const result = getResult(source, context);

      expect(result).not.toBeNull();
      expect(result?.from).toBe(0);
    });

    it("detects [[ in middle of line", () => {
      const source = createInternalLinkCompletionSource(mockOptions);
      const context = createMockContext("See [[test", 10);

      const result = getResult(source, context);

      expect(result).not.toBeNull();
      expect(result?.from).toBe(4);
    });

    it("detects [[ after other text", () => {
      const source = createInternalLinkCompletionSource(mockOptions);
      const context = createMockContext("Refer to [[t", 12);

      const result = getResult(source, context);

      expect(result).not.toBeNull();
    });

    it("handles multiple [[ on same line (uses last unclosed)", () => {
      const source = createInternalLinkCompletionSource(mockOptions);
      // First [[ is closed, second is open
      const context = createMockContext("[[first]] and [[t", 17);

      const result = getResult(source, context);

      expect(result).not.toBeNull();
      // Should trigger from the second [[ at position 14
      expect(result?.from).toBe(14);
    });
  });

  describe("Heading suggestions", () => {
    it("includes heading suggestions when provided", () => {
      const mockHeadings = [
        {
          type: "heading" as const,
          name: "Introduction",
          path: "/doc.md",
          displayPath: "doc.md",
          headingId: "introduction",
          headingLevel: 1 as const,
        },
      ];

      const source = createInternalLinkCompletionSource({
        getFileSuggestions: () => [],
        getHeadingSuggestions: () => mockHeadings,
      });
      const context = createMockContext("[[intro", 7);

      const result = getResult(source, context);

      expect(result).not.toBeNull();
      expect(result?.options.some((o) => o.label === "Introduction")).toBe(true);
    });
  });
});
