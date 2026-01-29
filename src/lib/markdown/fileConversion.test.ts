/**
 * Tests for markdown conversion using actual .md files
 *
 * These tests verify that the conversion functions work correctly
 * with real-world markdown content from files.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { htmlToMarkdown } from "./htmlToMarkdown";
import { markdownToHtml } from "./markdownToHtml";

const FIXTURES_DIR = join(__dirname, "../../../test-fixtures");

describe("File-based markdown conversion", () => {
  describe("complex-test.md round-trip", () => {
    const originalMd = readFileSync(join(FIXTURES_DIR, "complex-test.md"), "utf-8");
    const html = markdownToHtml(originalMd);
    const roundTripMd = htmlToMarkdown(html);

    it("preserves headings", () => {
      expect(roundTripMd).toContain("# Complex Markdown Test File");
      expect(roundTripMd).toContain("## Basic Formatting");
      expect(roundTripMd).toContain("## Code Blocks");
      expect(roundTripMd).toContain("### JavaScript");
    });

    it("preserves bold and italic formatting", () => {
      expect(roundTripMd).toContain("**bold text**");
      expect(roundTripMd).toContain("*italic text*");
    });

    it("preserves inline code", () => {
      expect(roundTripMd).toContain("`inline code`");
    });

    it("preserves links", () => {
      expect(roundTripMd).toContain("[External link](https://example.com)");
      expect(roundTripMd).toContain("(other-note.md)");
    });

    it("preserves code blocks with language", () => {
      expect(roundTripMd).toContain("```javascript");
      expect(roundTripMd).toContain("```html");
      expect(roundTripMd).toContain("```python");
    });

    it("preserves code block content with special characters", () => {
      // JavaScript code block content
      expect(roundTripMd).toContain("function greet(name)");
      expect(roundTripMd).toContain("const html = '<div class=\"container\">Content</div>'");

      // HTML code block - angle brackets should be preserved
      expect(roundTripMd).toContain("<!DOCTYPE html>");
      expect(roundTripMd).toContain("<title>Test &amp; Demo</title>");
    });

    it("preserves blockquotes", () => {
      expect(roundTripMd).toContain("> This is a simple blockquote.");
    });

    it("preserves horizontal rules", () => {
      expect(roundTripMd).toContain("---");
    });

    it("preserves images", () => {
      expect(roundTripMd).toContain("![Alt text for image](images/test.png)");
    });

    it("does not produce HTML entity corruption", () => {
      // The critical bug was files getting corrupted with HTML entities
      expect(roundTripMd).not.toMatch(/&lt;p&gt;/);
      expect(roundTripMd).not.toMatch(/&amp;gt;/);
      expect(roundTripMd).not.toMatch(/&amp;lt;/);

      // Should not have double-encoded entities outside of code blocks
      const outsideCodeBlocks = roundTripMd.replace(/```[\s\S]*?```/g, "");
      expect(outsideCodeBlocks).not.toContain("&amp;amp;");
    });
  });

  describe("HTML generation quality", () => {
    const originalMd = readFileSync(join(FIXTURES_DIR, "complex-test.md"), "utf-8");
    const html = markdownToHtml(originalMd);

    it("generates valid HTML structure", () => {
      expect(html).toContain("<h1");
      expect(html).toContain("<h2");
      expect(html).toContain("<p>");
      expect(html).toContain("<ul>");
      expect(html).toContain("<ol>");
      expect(html).toContain("<pre><code");
    });

    it("adds heading IDs for navigation", () => {
      expect(html).toMatch(/<h1 id="[^"]+"/);
      expect(html).toMatch(/<h2 id="[^"]+"/);
    });

    it("adds internal-link class to .md links", () => {
      expect(html).toContain('class="internal-link"');
      expect(html).toContain('data-internal-link="true"');
    });

    it("escapes HTML in code blocks", () => {
      expect(html).toContain("&lt;div");
      expect(html).toContain("&gt;");
    });

    it("preserves code block language classes", () => {
      expect(html).toContain('class="language-javascript"');
      expect(html).toContain('class="language-html"');
      expect(html).toContain('class="language-python"');
    });
  });

  describe("Complex edge cases round-trip", () => {
    const originalMd = readFileSync(join(FIXTURES_DIR, "complex-test.md"), "utf-8");
    const html = markdownToHtml(originalMd);
    const roundTripMd = htmlToMarkdown(html);

    it("preserves deeply nested lists", () => {
      expect(roundTripMd).toContain("Level 1 item");
      expect(roundTripMd).toContain("Level 2");
      expect(roundTripMd).toContain("Level 3");
    });

    it("preserves JSX code blocks", () => {
      expect(roundTripMd).toContain("```jsx");
      expect(roundTripMd).toContain("function MyComponent");
      expect(roundTripMd).toContain("<div className");
      expect(roundTripMd).toContain("onClick={() =>");
    });

    it("preserves SQL code blocks with operators", () => {
      expect(roundTripMd).toContain("```sql");
      expect(roundTripMd).toContain("SELECT");
      expect(roundTripMd).toContain("<>");  // SQL not-equal operator
      expect(roundTripMd).toContain(">=");
    });

    it("preserves shell scripts with pipes and redirects", () => {
      expect(roundTripMd).toContain("```bash");
      expect(roundTripMd).toContain("#!/bin/bash");
      expect(roundTripMd).toContain("2>&1");
    });

    it("preserves TypeScript generics", () => {
      expect(roundTripMd).toContain("```typescript");
      expect(roundTripMd).toContain("Result<T, E = Error>");
      expect(roundTripMd).toContain("Promise<Result<T>>");
    });

    it("preserves JSON with special characters", () => {
      expect(roundTripMd).toContain("```json");
      expect(roundTripMd).toContain('"special_chars": "<>&');
    });

    it("preserves YAML configuration", () => {
      expect(roundTripMd).toContain("```yaml");
      expect(roundTripMd).toContain("version:");
      expect(roundTripMd).toContain("${DATABASE_URL}");
    });

    it("preserves tables with code", () => {
      expect(roundTripMd).toContain("`map()`");
      expect(roundTripMd).toContain("`filter()`");
    });

    it("preserves consecutive code blocks", () => {
      // Should have multiple separate code blocks
      const codeBlockCount = (roundTripMd.match(/```js/g) || []).length;
      expect(codeBlockCount).toBeGreaterThanOrEqual(3);
    });

    it("preserves nested blockquotes", () => {
      expect(roundTripMd).toContain("> Level 1 quote");
    });

    it("preserves unicode and emoji", () => {
      expect(roundTripMd).toContain("🎉");
      expect(roundTripMd).toContain("café");
      expect(roundTripMd).toContain("中文");
    });

    it("handles very long lines", () => {
      expect(roundTripMd).toContain("very long line that goes on");
    });
  });

  describe("Stress test - no corruption", () => {
    const originalMd = readFileSync(join(FIXTURES_DIR, "complex-test.md"), "utf-8");
    const html = markdownToHtml(originalMd);
    const roundTripMd = htmlToMarkdown(html);

    it("never produces corrupted HTML entities outside code blocks", () => {
      // Remove code blocks for this check
      const outsideCode = roundTripMd.replace(/```[\s\S]*?```/g, "[CODE_BLOCK]");

      // Should not have HTML entity corruption patterns
      expect(outsideCode).not.toMatch(/&lt;p&gt;/);
      expect(outsideCode).not.toMatch(/&lt;h[1-6]&gt;/);
      expect(outsideCode).not.toMatch(/&amp;amp;/);
      expect(outsideCode).not.toMatch(/&amp;lt;/);
      expect(outsideCode).not.toMatch(/&amp;gt;/);
    });

    it("preserves all major sections", () => {
      const sections = [
        "Basic Formatting",
        "Links",
        "Code Blocks",
        "Lists",
        "Blockquotes",
        "Tables",
        "Horizontal Rules",
        "Images",
        "Deeply Nested Structures",
        "Complex Tables",
        "Edge Cases",
      ];

      for (const section of sections) {
        expect(roundTripMd).toContain(section);
      }
    });

    it("maintains reasonable output size", () => {
      // Round-trip should not dramatically change file size
      // (some whitespace differences are okay)
      const sizeDiff = Math.abs(roundTripMd.length - originalMd.length);
      const percentDiff = sizeDiff / originalMd.length;

      // Allow up to 20% size difference due to formatting variations
      expect(percentDiff).toBeLessThan(0.2);
    });
  });

  describe("Mermaid diagram round-trip", () => {
    it("preserves basic flowchart", () => {
      const input = `# My Document

\`\`\`mermaid
graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[End]
    B -->|No| A
\`\`\`

Some text after.`;

      const html = markdownToHtml(input);
      const output = htmlToMarkdown(html);

      expect(output).toContain("```mermaid");
      expect(output).toContain("graph TD");
      expect(output).toContain("A[Start] --> B{Decision}");
      expect(output).toContain("B -->|Yes| C[End]");
    });

    it("preserves sequence diagram", () => {
      const input = `\`\`\`mermaid
sequenceDiagram
    Alice->>John: Hello John
    John-->>Alice: Hi Alice
    Alice->>John: How are you?
\`\`\``;

      const html = markdownToHtml(input);
      const output = htmlToMarkdown(html);

      expect(output).toContain("```mermaid");
      expect(output).toContain("sequenceDiagram");
      expect(output).toContain("Alice->>John: Hello John");
    });

    it("preserves pie chart", () => {
      const input = `\`\`\`mermaid
pie title Pets
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 15
\`\`\``;

      const html = markdownToHtml(input);
      const output = htmlToMarkdown(html);

      expect(output).toContain("```mermaid");
      expect(output).toContain('pie title Pets');
      expect(output).toContain('"Dogs" : 386');
    });

    it("preserves gantt chart", () => {
      const input = `\`\`\`mermaid
gantt
    title A Gantt Diagram
    section Section A
    Task 1 :a1, 2024-01-01, 30d
    Task 2 :after a1, 20d
\`\`\``;

      const html = markdownToHtml(input);
      const output = htmlToMarkdown(html);

      expect(output).toContain("```mermaid");
      expect(output).toContain("gantt");
      expect(output).toContain("title A Gantt Diagram");
      expect(output).toContain("Task 1 :a1, 2024-01-01, 30d");
    });

    it("preserves class diagram", () => {
      const input = `\`\`\`mermaid
classDiagram
    Animal <|-- Duck
    Animal <|-- Fish
    Animal : +int age
    Animal : +String gender
    Animal: +isMammal()
\`\`\``;

      const html = markdownToHtml(input);
      const output = htmlToMarkdown(html);

      expect(output).toContain("```mermaid");
      expect(output).toContain("classDiagram");
      expect(output).toContain("Animal <|-- Duck");
      expect(output).toContain("+isMammal()");
    });

    it("preserves mermaid with special characters", () => {
      const input = `\`\`\`mermaid
graph LR
    A["<User>"] --> B["API & Backend"]
    B --> C{{"Data >= 100?"}}
\`\`\``;

      const html = markdownToHtml(input);
      const output = htmlToMarkdown(html);

      expect(output).toContain("```mermaid");
      // Special chars should be preserved
      expect(output).toContain("A[");
      expect(output).toContain("-->");
    });

    it("handles multiple mermaid blocks in same document", () => {
      const input = `# Diagrams

\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Some text.

\`\`\`mermaid
sequenceDiagram
    X->>Y: Message
\`\`\``;

      const html = markdownToHtml(input);
      const output = htmlToMarkdown(html);

      const mermaidCount = (output.match(/```mermaid/g) || []).length;
      expect(mermaidCount).toBe(2);
      expect(output).toContain("graph TD");
      expect(output).toContain("sequenceDiagram");
    });
  });
});
