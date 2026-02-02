/**
 * Tests for Markdown Chunker
 */

import { describe, it, expect } from "vitest";
import {
  chunkMarkdown,
  estimateTokens,
  computeContentHash,
} from "./markdownChunker";

describe("markdownChunker", () => {
  describe("estimateTokens", () => {
    it("estimates roughly 4 characters per token", () => {
      expect(estimateTokens("")).toBe(0);
      expect(estimateTokens("test")).toBe(1);
      expect(estimateTokens("hello world")).toBe(3); // 11 chars / 4 = 2.75 -> 3
      expect(estimateTokens("a".repeat(100))).toBe(25);
    });
  });

  describe("computeContentHash", () => {
    it("returns consistent hash for same content", () => {
      const content = "Hello, World!";
      const hash1 = computeContentHash(content);
      const hash2 = computeContentHash(content);
      expect(hash1).toBe(hash2);
    });

    it("returns different hash for different content", () => {
      const hash1 = computeContentHash("Hello");
      const hash2 = computeContentHash("World");
      expect(hash1).not.toBe(hash2);
    });

    it("handles empty string", () => {
      const hash = computeContentHash("");
      expect(hash).toBe("0");
    });
  });

  describe("chunkMarkdown", () => {
    it("returns empty array for empty content", () => {
      const chunks = chunkMarkdown("", "/test.md");
      expect(chunks).toEqual([]);
    });

    it("returns empty array for whitespace-only content", () => {
      const chunks = chunkMarkdown("   \n\n   ", "/test.md");
      expect(chunks).toEqual([]);
    });

    it("returns single chunk for short documents", () => {
      const content = "# Hello\n\nThis is a short document.";
      const chunks = chunkMarkdown(content, "/test.md");

      expect(chunks).toHaveLength(1);
      expect(chunks[0].filePath).toBe("/test.md");
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].text).toBe(content);
      expect(chunks[0].startOffset).toBe(0);
      expect(chunks[0].endOffset).toBe(content.length);
    });

    it("splits on headings", () => {
      const content = `# Heading 1

Some content under heading 1.

# Heading 2

Some content under heading 2.

# Heading 3

Some content under heading 3.`;

      // Use small chunk size to force splitting
      const chunks = chunkMarkdown(content, "/test.md", {
        chunkSize: 50,
        chunkOverlap: 10,
      });

      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk should contain at least one heading or content
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeGreaterThan(0);
      });
    });

    it("splits on paragraphs (double newline)", () => {
      const content = `First paragraph with some content.

Second paragraph with more content.

Third paragraph with even more content.

Fourth paragraph with additional content.`;

      const chunks = chunkMarkdown(content, "/test.md", {
        chunkSize: 60,
        chunkOverlap: 10,
      });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it("preserves code blocks when possible", () => {
      const content = `# Code Example

Here's some code:

\`\`\`javascript
function hello() {
  console.log("Hello, World!");
}
\`\`\`

And some text after.`;

      const chunks = chunkMarkdown(content, "/test.md", {
        chunkSize: 200,
        chunkOverlap: 20,
      });

      // Should not split in the middle of a code block
      const codeChunk = chunks.find((c) => c.text.includes("console.log"));
      expect(codeChunk).toBeDefined();
      expect(codeChunk!.text).toContain("function hello()");
    });

    it("includes file path in all chunks", () => {
      const content = "# A\n\nPara 1\n\n# B\n\nPara 2";
      const chunks = chunkMarkdown(content, "/path/to/file.md", {
        chunkSize: 20,
        chunkOverlap: 5,
      });

      chunks.forEach((chunk) => {
        expect(chunk.filePath).toBe("/path/to/file.md");
      });
    });

    it("assigns sequential chunk indices", () => {
      const content = "Para 1.\n\nPara 2.\n\nPara 3.\n\nPara 4.";
      const chunks = chunkMarkdown(content, "/test.md", {
        chunkSize: 15,
        chunkOverlap: 3,
      });

      for (let i = 0; i < chunks.length; i++) {
        expect(chunks[i].chunkIndex).toBe(i);
      }
    });

    it("handles documents with only headings", () => {
      const content = `# Heading 1

# Heading 2

# Heading 3`;

      const chunks = chunkMarkdown(content, "/test.md", {
        chunkSize: 20,
        chunkOverlap: 5,
      });

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeGreaterThan(0);
      });
    });

    it("handles horizontal rules", () => {
      const content = `Section 1

---

Section 2

***

Section 3`;

      const chunks = chunkMarkdown(content, "/test.md", {
        chunkSize: 30,
        chunkOverlap: 5,
      });

      expect(chunks.length).toBeGreaterThan(1);
    });

    it("normalizes line endings", () => {
      const content = "Line 1\r\nLine 2\r\nLine 3";
      const chunks = chunkMarkdown(content, "/test.md");

      expect(chunks[0].text).not.toContain("\r");
      expect(chunks[0].text).toContain("\n");
    });

    it("trims chunk text", () => {
      const content = "  \n\n  Content with whitespace  \n\n  ";
      const chunks = chunkMarkdown(content, "/test.md");

      expect(chunks[0].text).toBe("Content with whitespace");
    });

    it("handles very long continuous text", () => {
      // Create text without any separators
      const longWord = "a".repeat(2000);
      const chunks = chunkMarkdown(longWord, "/test.md", {
        chunkSize: 500,
        chunkOverlap: 50,
      });

      // Should split even without separators
      expect(chunks.length).toBeGreaterThan(1);
      // Each chunk should respect the size limit (with some tolerance for overlap)
      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(550); // size + overlap
      });
    });

    it("tracks offset positions correctly", () => {
      const content = "First chunk.\n\nSecond chunk.";
      const chunks = chunkMarkdown(content, "/test.md", {
        chunkSize: 20,
        chunkOverlap: 0,
      });

      // Verify the first chunk
      expect(chunks[0].startOffset).toBe(0);

      // Each chunk's text should be findable at its offset
      chunks.forEach((chunk) => {
        // Allow for trimming differences
        const originalText = content.slice(
          chunk.startOffset,
          chunk.endOffset
        );
        expect(originalText.trim()).toContain(chunk.text.substring(0, 10));
      });
    });
  });

  describe("edge cases", () => {
    it("handles markdown with special characters", () => {
      const content = `# Title with *emphasis* and **bold**

- List item 1
- List item 2
  - Nested item

> Blockquote with \`inline code\`

| Table | Header |
|-------|--------|
| Cell  | Cell   |`;

      const chunks = chunkMarkdown(content, "/test.md");
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain("emphasis");
    });

    it("handles deeply nested content", () => {
      const content = `# Level 1

## Level 2

### Level 3

#### Level 4

##### Level 5

###### Level 6`;

      const chunks = chunkMarkdown(content, "/test.md", {
        chunkSize: 50,
        chunkOverlap: 10,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });

    it("handles multiple code blocks", () => {
      const content = `\`\`\`python
def foo():
    pass
\`\`\`

Some text.

\`\`\`javascript
const bar = () => {};
\`\`\``;

      const chunks = chunkMarkdown(content, "/test.md", {
        chunkSize: 100,
        chunkOverlap: 20,
      });

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});
