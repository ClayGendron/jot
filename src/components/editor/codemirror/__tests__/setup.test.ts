/**
 * Tests for CodeMirror 6 Setup
 *
 * Phase 1: Verify basic editor functionality and markdown handling.
 */

import { describe, it, expect } from "vitest";
import { createEditorState, createExtensions } from "../setup";

describe("CodeMirror Setup", () => {
  describe("createExtensions", () => {
    it("creates extensions without line numbers by default", () => {
      const extensions = createExtensions();
      expect(extensions).toBeDefined();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions.length).toBeGreaterThan(0);
    });

    it("creates extensions with line numbers when requested", () => {
      const withLineNumbers = createExtensions({ showLineNumbers: true });
      const withoutLineNumbers = createExtensions({ showLineNumbers: false });

      // Extensions with line numbers should have more extensions
      expect(withLineNumbers.length).toBeGreaterThan(withoutLineNumbers.length);
    });
  });

  describe("createEditorState", () => {
    it("creates editor state with empty content", () => {
      const state = createEditorState("");
      expect(state).toBeDefined();
      expect(state.doc.toString()).toBe("");
    });

    it("creates editor state with markdown content", () => {
      const markdown = "# Hello World\n\nThis is **bold** and *italic*.";
      const state = createEditorState(markdown);

      expect(state.doc.toString()).toBe(markdown);
    });

    it("preserves markdown content exactly as provided", () => {
      const testCases = [
        // Headers
        "# Heading 1\n## Heading 2\n### Heading 3",
        // Lists
        "- Item 1\n- Item 2\n  - Nested item",
        // Code blocks
        "```javascript\nconst x = 1;\n```",
        // Links
        "[Link text](https://example.com)",
        // Images
        "![Alt text](image.png)",
        // Bold and italic
        "**bold** and *italic* and ***both***",
        // Blockquotes
        "> This is a quote\n> spanning multiple lines",
        // Task lists
        "- [ ] Todo item\n- [x] Done item",
        // Tables
        "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |",
        // Mixed content
        "# Title\n\nParagraph with **bold** and `code`.\n\n- List item\n\n```\ncode block\n```",
      ];

      for (const markdown of testCases) {
        const state = createEditorState(markdown);
        expect(state.doc.toString()).toBe(markdown);
      }
    });

    it("preserves trailing newlines", () => {
      const markdown = "Content\n\n";
      const state = createEditorState(markdown);
      expect(state.doc.toString()).toBe(markdown);
    });

    it("normalizes Windows line endings (CRLF) to LF", () => {
      // CodeMirror normalizes CRLF to LF internally - this is expected behavior
      // The save pipeline also normalizes to LF before writing to disk
      const crlfMarkdown = "Line 1\r\nLine 2\r\nLine 3";
      const state = createEditorState(crlfMarkdown);
      // CodeMirror converts CRLF to LF
      expect(state.doc.toString()).toBe("Line 1\nLine 2\nLine 3");
    });

    it("handles unicode content", () => {
      const markdown = "# 你好世界\n\nThis has emoji 🎉 and special chars: é, ñ, ü";
      const state = createEditorState(markdown);
      expect(state.doc.toString()).toBe(markdown);
    });
  });

  describe("Markdown canonical format", () => {
    it("does not modify markdown on state creation", () => {
      // This is critical for Phase 1: markdown must be stored as-is
      const originalMarkdown = `# Document Title

This is a paragraph with **bold text** and *italic text*.

## Section 1

- First item
- Second item with \`inline code\`

\`\`\`typescript
function hello(): string {
  return "Hello, World!";
}
\`\`\`

> A blockquote
> spanning multiple lines

| Column A | Column B |
|----------|----------|
| Data 1   | Data 2   |

[Link to example](https://example.com)

![Image alt text](./image.png)
`;

      const state = createEditorState(originalMarkdown);
      const retrievedMarkdown = state.doc.toString();

      // Content must be byte-for-byte identical
      expect(retrievedMarkdown).toBe(originalMarkdown);
    });
  });
});
