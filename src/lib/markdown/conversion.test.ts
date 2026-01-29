import { describe, it, expect } from "vitest";
import { htmlToMarkdown } from "./htmlToMarkdown";
import { markdownToHtml } from "./markdownToHtml";

describe("Markdown conversion round-trip", () => {
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

    expect(resultMd).toContain("- Item 1");
    expect(resultMd).toContain("- Item 2");
    expect(resultMd).toContain("- Item 3");
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
    expect(resultMd).toContain("- List item 1");
    expect(resultMd).toContain("[other note](other.md)");
    expect(resultMd).toContain("```javascript");
    expect(resultMd).toContain("> A quote for emphasis.");
  });
});
