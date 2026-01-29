import { describe, it, expect } from "vitest";
import { htmlToMarkdown } from "./htmlToMarkdown";
import { markdownToHtml } from "./markdownToHtml";

describe("Markdown conversion round-trip", () => {
  describe("HTML special characters in code blocks", () => {
    it("preserves < and > in code blocks", () => {
      const originalMd = "```html\n<div>Hello</div>\n```";
      const html = markdownToHtml(originalMd);
      const resultMd = htmlToMarkdown(html);

      expect(resultMd).toContain("<div>Hello</div>");
      expect(resultMd).not.toContain("&lt;");
      expect(resultMd).not.toContain("&gt;");
    });

    it("preserves & in code blocks", () => {
      const originalMd = "```javascript\nconst a = b && c;\n```";
      const html = markdownToHtml(originalMd);
      const resultMd = htmlToMarkdown(html);

      expect(resultMd).toContain("b && c");
      expect(resultMd).not.toContain("&amp;");
    });

    it("preserves HTML entities in code blocks", () => {
      const originalMd = "```\nconst html = '<p>&nbsp;</p>';\n```";
      const html = markdownToHtml(originalMd);
      const resultMd = htmlToMarkdown(html);

      expect(resultMd).toContain("<p>&nbsp;</p>");
    });

    it("preserves complex HTML in code blocks", () => {
      const originalMd = `\`\`\`jsx
function Component() {
  return <div className="test">{items.map(i => <span key={i}>{i}</span>)}</div>;
}
\`\`\``;
      const html = markdownToHtml(originalMd);
      const resultMd = htmlToMarkdown(html);

      expect(resultMd).toContain('<div className="test">');
      expect(resultMd).toContain("<span key={i}>");
    });
  });

  describe("HTML special characters in inline code", () => {
    it("preserves < and > in inline code", () => {
      const originalMd = "Use `<div>` for containers.";
      const html = markdownToHtml(originalMd);
      const resultMd = htmlToMarkdown(html);

      expect(resultMd).toContain("`<div>`");
      expect(resultMd).not.toContain("&lt;");
    });

    it("preserves & in inline code", () => {
      const originalMd = "The expression `a && b` returns true.";
      const html = markdownToHtml(originalMd);
      const resultMd = htmlToMarkdown(html);

      expect(resultMd).toContain("`a && b`");
      expect(resultMd).not.toContain("&amp;");
    });
  });

  describe("Nested formatting edge cases", () => {
    it("preserves bold inside italic", () => {
      const originalMd = "*This is **bold** inside italic*";
      const html = markdownToHtml(originalMd);
      const resultMd = htmlToMarkdown(html);

      expect(resultMd).toContain("**bold**");
      expect(resultMd).toMatch(/\*.*bold.*\*/);
    });

    it("preserves multiple nested formats", () => {
      const originalMd = "**bold with *italic* inside**";
      const html = markdownToHtml(originalMd);
      const resultMd = htmlToMarkdown(html);

      expect(resultMd).toContain("*italic*");
    });
  });

  describe("Tables with special characters", () => {
    it("preserves tables with special characters in cells", () => {
      const originalMd = `| Command | Description |
| --- | --- |
| \`git add\` | Stage changes |
| \`npm run build\` | Build project |`;
      const html = markdownToHtml(originalMd);
      const resultMd = htmlToMarkdown(html);

      expect(resultMd).toContain("git add");
      expect(resultMd).toContain("npm run build");
    });
  });

  describe("Critical: No HTML entity corruption", () => {
    it("never produces &lt; in output (except in code)", () => {
      const testCases = [
        "# Simple Heading",
        "**bold** and *italic*",
        "- list item\n- another item",
        "> blockquote text",
        "[link](url.md)",
      ];

      for (const md of testCases) {
        const html = markdownToHtml(md);
        const resultMd = htmlToMarkdown(html);

        // Output should not contain HTML entities (corruption indicator)
        expect(resultMd).not.toMatch(/&lt;p&gt;/);
        expect(resultMd).not.toMatch(/&amp;gt;/);
      }
    });

    it("handles content that looks like HTML in paragraphs", () => {
      // Users might type things that look like HTML tags
      const originalMd = "The <foo> tag is not standard HTML.";
      const html = markdownToHtml(originalMd);
      const resultMd = htmlToMarkdown(html);

      // Should preserve the text, not corrupt it
      expect(resultMd).not.toContain("&lt;foo&gt;");
    });

    it("recovers from corrupted HTML-encoded input", () => {
      // This is the actual corruption pattern: markdown wrapped in <p> with entities
      // This can happen when TipTap treats markdown as plain text
      const corruptedHtml = "<p># Jot - Feature Scope &amp; Kanban Board &gt; A lightweight editor.</p>";
      const resultMd = htmlToMarkdown(corruptedHtml);

      // Should decode the entities and produce readable text
      expect(resultMd).toContain("# Jot - Feature Scope & Kanban Board");
      expect(resultMd).not.toContain("&amp;");
      expect(resultMd).not.toContain("&gt;");
    });

    it("handles severely corrupted content with nested entities", () => {
      // Even worse case: double-encoded entities
      const corruptedHtml = "<p>&lt;p&gt;# Title&lt;/p&gt;</p>";
      const resultMd = htmlToMarkdown(corruptedHtml);

      // Should decode and not produce HTML entities in output
      expect(resultMd).not.toMatch(/&lt;/);
      expect(resultMd).not.toMatch(/&gt;/);
    });
  });

  describe("Exact round-trip preservation", () => {
    const roundTripCases = [
      { name: "simple heading", md: "# Title" },
      { name: "heading with special chars", md: "# Title & Subtitle" },
      { name: "paragraph", md: "Just some text." },
      { name: "bold", md: "**bold text**" },
      { name: "italic", md: "*italic text*" },
      { name: "inline code", md: "`code here`" },
      { name: "link", md: "[text](url.md)" },
      { name: "image", md: "![alt](image.png)" },
      { name: "unordered list", md: "- item 1\n- item 2" },
      { name: "ordered list", md: "1. first\n2. second" },
      { name: "blockquote", md: "> quoted text" },
      { name: "horizontal rule", md: "---" },
    ];

    for (const { name, md } of roundTripCases) {
      it(`round-trips ${name}`, () => {
        const html = markdownToHtml(md);
        const resultMd = htmlToMarkdown(html);

        // The content should be semantically equivalent
        // (whitespace differences are acceptable)
        expect(resultMd.replace(/\s+/g, " ").trim()).toBe(
          md.replace(/\s+/g, " ").trim()
        );
      });
    }
  });

  it("preserves basic headings through conversion", () => {
    const originalMd = "# Title\n\n## Subtitle";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    expect(resultMd).toContain("# Title");
    expect(resultMd).toContain("## Subtitle");
  });

  it("preserves paragraphs through conversion", () => {
    const originalMd = "First paragraph.\n\nSecond paragraph.";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    expect(resultMd).toContain("First paragraph.");
    expect(resultMd).toContain("Second paragraph.");
  });

  it("preserves bold text through conversion", () => {
    const originalMd = "This is **bold** text.";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    expect(resultMd).toContain("**bold**");
  });

  it("preserves italic text through conversion", () => {
    const originalMd = "This is *italic* text.";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    expect(resultMd).toContain("*italic*");
  });

  it("preserves links through conversion", () => {
    const originalMd = "[Link text](note.md)";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    expect(resultMd).toContain("[Link text](note.md)");
  });

  it("preserves internal links with class through conversion", () => {
    const originalMd = "[Note](note.md)";
    const html = markdownToHtml(originalMd);
    // HTML should have internal-link class
    expect(html).toContain('class="internal-link"');
    // After conversion back, link should be preserved
    const resultMd = htmlToMarkdown(html);
    expect(resultMd).toContain("[Note](note.md)");
  });

  it("preserves unordered lists through conversion", () => {
    const originalMd = "- Item 1\n- Item 2\n- Item 3";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    expect(resultMd).toContain("Item 1");
    expect(resultMd).toContain("Item 2");
    expect(resultMd).toContain("Item 3");
    expect(resultMd).toMatch(/[-*]\s+Item 1/); // Accepts - or * with any spacing
  });

  it("preserves ordered lists through conversion", () => {
    const originalMd = "1. First\n2. Second\n3. Third";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    // Check the items are preserved (numbers might vary based on conversion)
    expect(resultMd).toContain("First");
    expect(resultMd).toContain("Second");
    expect(resultMd).toContain("Third");
    // Check it's still a list (has number followed by period)
    expect(resultMd).toMatch(/\d+\.\s+First/);
  });

  it("preserves code blocks through conversion", () => {
    const originalMd = "```javascript\nconst x = 1;\n```";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    expect(resultMd).toContain("```javascript");
    expect(resultMd).toContain("const x = 1;");
    expect(resultMd).toContain("```");
  });

  it("preserves inline code through conversion", () => {
    const originalMd = "Use `console.log()` for debugging.";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    expect(resultMd).toContain("`console.log()`");
  });

  it("preserves blockquotes through conversion", () => {
    const originalMd = "> This is a quote.";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    expect(resultMd).toContain("> This is a quote.");
  });

  it("preserves horizontal rules through conversion", () => {
    const originalMd = "Before\n\n---\n\nAfter";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    expect(resultMd).toContain("---");
  });

  it("preserves images through conversion", () => {
    const originalMd = "![Alt text](image.png)";
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    expect(resultMd).toContain("![Alt text](image.png)");
  });

  it("preserves complex document structure", () => {
    const originalMd = `# Main Title

Introduction paragraph with **bold** and *italic* text.

## Section 1

- List item 1
- List item 2

Link to [other note](other.md).

\`\`\`javascript
const code = true;
\`\`\`

## Section 2

> A quote for emphasis.
`;
    const html = markdownToHtml(originalMd);
    const resultMd = htmlToMarkdown(html);

    // Check key elements are preserved
    expect(resultMd).toContain("# Main Title");
    expect(resultMd).toContain("**bold**");
    expect(resultMd).toContain("*italic*");
    expect(resultMd).toContain("## Section 1");
    expect(resultMd).toContain("List item 1");
    expect(resultMd).toMatch(/[-*]\s+List item 1/); // Accepts - or *
    expect(resultMd).toContain("[other note](other.md)");
    expect(resultMd).toContain("```javascript");
    expect(resultMd).toContain("> A quote for emphasis.");
  });
});
