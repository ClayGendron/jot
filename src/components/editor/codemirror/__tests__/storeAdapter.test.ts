/**
 * Store Adapter Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getMarkdownFromStore,
  setMarkdownToStore,
  createStoreAdapter,
} from "../storeAdapter";
import { useEditorStore } from "@/stores/editorStore";

describe("storeAdapter", () => {
  beforeEach(() => {
    // Reset store to initial state
    useEditorStore.setState({
      content: "",
      isDirty: false,
    });
  });

  describe("getMarkdownFromStore", () => {
    it("returns empty string for empty content", () => {
      expect(getMarkdownFromStore()).toBe("");
    });

    it("returns empty string for empty paragraph", () => {
      useEditorStore.setState({ content: "<p></p>" });
      expect(getMarkdownFromStore()).toBe("");
    });

    it("converts HTML heading to markdown", () => {
      useEditorStore.setState({ content: "<h1>Hello World</h1>" });
      expect(getMarkdownFromStore()).toBe("# Hello World");
    });

    it("converts HTML paragraph to markdown", () => {
      useEditorStore.setState({ content: "<p>Some text here</p>" });
      expect(getMarkdownFromStore()).toBe("Some text here");
    });

    it("converts bold HTML to markdown", () => {
      useEditorStore.setState({ content: "<p><strong>bold</strong></p>" });
      expect(getMarkdownFromStore()).toBe("**bold**");
    });

    it("converts italic HTML to markdown", () => {
      useEditorStore.setState({ content: "<p><em>italic</em></p>" });
      expect(getMarkdownFromStore()).toBe("*italic*");
    });

    it("converts bullet list to markdown", () => {
      useEditorStore.setState({
        content: "<ul><li>Item 1</li><li>Item 2</li></ul>",
      });
      const result = getMarkdownFromStore();
      // Turndown may use different spacing, so check structure
      expect(result).toMatch(/^-\s+Item 1\n-\s+Item 2$/);
    });
  });

  describe("setMarkdownToStore", () => {
    it("converts empty markdown to empty paragraph HTML", () => {
      setMarkdownToStore("");
      expect(useEditorStore.getState().content).toBe("<p></p>");
    });

    it("converts markdown heading to HTML", () => {
      setMarkdownToStore("# Hello World");
      const content = useEditorStore.getState().content;
      expect(content).toContain("<h1");
      expect(content).toContain("Hello World");
    });

    it("converts markdown paragraph to HTML", () => {
      setMarkdownToStore("Some text here");
      expect(useEditorStore.getState().content).toContain("<p>Some text here</p>");
    });

    it("converts markdown bold to HTML", () => {
      setMarkdownToStore("**bold**");
      const content = useEditorStore.getState().content;
      expect(content).toContain("<strong>bold</strong>");
    });

    it("converts markdown italic to HTML", () => {
      setMarkdownToStore("*italic*");
      const content = useEditorStore.getState().content;
      expect(content).toContain("<em>italic</em>");
    });

    it("marks document as dirty", () => {
      expect(useEditorStore.getState().isDirty).toBe(false);
      setMarkdownToStore("Some new content");
      expect(useEditorStore.getState().isDirty).toBe(true);
    });
  });

  describe("createStoreAdapter", () => {
    it("creates adapter with getInitialMarkdown", () => {
      const adapter = createStoreAdapter();
      expect(typeof adapter.getInitialMarkdown).toBe("function");
    });

    it("creates adapter with setContent", () => {
      const adapter = createStoreAdapter();
      expect(typeof adapter.setContent).toBe("function");
    });

    it("creates adapter with subscribe", () => {
      const adapter = createStoreAdapter();
      expect(typeof adapter.subscribe).toBe("function");
    });

    it("getInitialMarkdown returns current store content as markdown", () => {
      useEditorStore.setState({ content: "<h2>Test</h2>" });
      const adapter = createStoreAdapter();
      expect(adapter.getInitialMarkdown()).toBe("## Test");
    });

    it("setContent updates store with HTML", () => {
      const adapter = createStoreAdapter();
      adapter.setContent("# New Heading");
      const content = useEditorStore.getState().content;
      expect(content).toContain("<h1");
      expect(content).toContain("New Heading");
    });

    it("subscribe calls callback on content changes", () => {
      const adapter = createStoreAdapter();
      const callback = vi.fn();

      const unsubscribe = adapter.subscribe(callback);

      // Change content
      useEditorStore.setState({ content: "<p>Changed</p>" });

      expect(callback).toHaveBeenCalledWith("Changed");

      unsubscribe();
    });

    it("subscribe returns unsubscribe function", () => {
      const adapter = createStoreAdapter();
      const callback = vi.fn();

      const unsubscribe = adapter.subscribe(callback);
      unsubscribe();

      // Change content after unsubscribe
      useEditorStore.setState({ content: "<p>New</p>" });

      // Callback should not have been called again
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("roundtrip conversion", () => {
    const testCases = [
      { md: "# Heading 1", description: "h1" },
      { md: "## Heading 2", description: "h2" },
      { md: "**bold text**", description: "bold" },
      { md: "*italic text*", description: "italic" },
      { md: "~~strikethrough~~", description: "strikethrough" },
      { md: "`inline code`", description: "inline code" },
      { md: "- Item 1\n- Item 2", description: "bullet list" },
      { md: "1. First\n2. Second", description: "ordered list" },
      { md: "> Quote", description: "blockquote" },
      { md: "[link](https://example.com)", description: "link" },
    ];

    testCases.forEach(({ md, description }) => {
      it(`preserves ${description} through roundtrip`, () => {
        setMarkdownToStore(md);
        const result = getMarkdownFromStore();
        // Normalize whitespace for comparison
        const normalizedMd = md.replace(/\s+/g, " ").trim();
        const normalizedResult = result.replace(/\s+/g, " ").trim();
        expect(normalizedResult).toBe(normalizedMd);
      });
    });
  });
});
