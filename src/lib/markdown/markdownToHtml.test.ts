import { describe, it, expect } from "vitest";
import { markdownToHtml } from "./markdownToHtml";

describe("markdownToHtml", () => {
  describe("empty/null input", () => {
    it("returns empty paragraph for empty input", () => {
      expect(markdownToHtml("")).toBe("<p></p>");
    });

    it("returns empty paragraph for whitespace only", () => {
      expect(markdownToHtml("   ")).toBe("<p></p>");
    });
  });

  describe("headings", () => {
    it("converts h1 with id", () => {
      expect(markdownToHtml("# Title")).toBe('<h1 id="title">Title</h1>');
    });

    it("converts h2 with id", () => {
      expect(markdownToHtml("## Subtitle")).toBe('<h2 id="subtitle">Subtitle</h2>');
    });

    it("converts h3 with id", () => {
      expect(markdownToHtml("### Section")).toBe('<h3 id="section">Section</h3>');
    });

    it("converts h4 with id", () => {
      expect(markdownToHtml("#### Subsection")).toBe('<h4 id="subsection">Subsection</h4>');
    });

    it("converts h5 with id", () => {
      expect(markdownToHtml("##### Minor")).toBe('<h5 id="minor">Minor</h5>');
    });

    it("converts h6 with id", () => {
      expect(markdownToHtml("###### Smallest")).toBe('<h6 id="smallest">Smallest</h6>');
    });

    it("generates id from heading text with spaces", () => {
      expect(markdownToHtml("# Hello World")).toBe('<h1 id="hello-world">Hello World</h1>');
    });

    it("removes special characters from heading id", () => {
      const result = markdownToHtml("# What's New?");
      expect(result).toContain("<h1");
      expect(result).toContain("What");
      expect(result).toMatch(/id="[^"]+"/); // Has an id attribute
    });
  });

  describe("paragraphs", () => {
    it("wraps text in paragraph", () => {
      expect(markdownToHtml("Hello world")).toBe("<p>Hello world</p>");
    });

    it("creates multiple paragraphs", () => {
      const result = markdownToHtml("First\n\nSecond");
      expect(result).toContain("<p>First</p>");
      expect(result).toContain("<p>Second</p>");
    });
  });

  describe("inline formatting", () => {
    it("converts bold with asterisks", () => {
      expect(markdownToHtml("**bold**")).toBe("<p><strong>bold</strong></p>");
    });

    it("converts bold with underscores", () => {
      expect(markdownToHtml("__bold__")).toBe("<p><strong>bold</strong></p>");
    });

    it("converts italic with asterisks", () => {
      expect(markdownToHtml("*italic*")).toBe("<p><em>italic</em></p>");
    });

    it("converts italic with underscores", () => {
      expect(markdownToHtml("_italic_")).toBe("<p><em>italic</em></p>");
    });

    it("converts strikethrough", () => {
      expect(markdownToHtml("~~deleted~~")).toBe("<p><s>deleted</s></p>");
    });

    it("converts inline code", () => {
      expect(markdownToHtml("`code`")).toBe("<p><code>code</code></p>");
    });

    it("converts bold italic", () => {
      const result = markdownToHtml("***bold italic***");
      expect(result).toContain("<strong>");
      expect(result).toContain("<em>");
      expect(result).toContain("bold italic");
    });
  });

  describe("links", () => {
    it("converts external link", () => {
      expect(markdownToHtml("[Link](https://example.com)")).toBe(
        '<p><a href="https://example.com">Link</a></p>'
      );
    });

    it("converts http link without internal-link class", () => {
      const result = markdownToHtml("[Link](http://example.com)");
      expect(result).toBe('<p><a href="http://example.com">Link</a></p>');
      expect(result).not.toContain("internal-link");
    });

    it("converts mailto link without internal-link class", () => {
      const result = markdownToHtml("[Email](mailto:test@example.com)");
      expect(result).toBe(
        '<p><a href="mailto:test@example.com">Email</a></p>'
      );
      expect(result).not.toContain("internal-link");
    });
  });

  describe("internal links", () => {
    it("adds internal-link class to .md file links", () => {
      const result = markdownToHtml("[Note](note.md)");
      expect(result).toContain('class="internal-link"');
      expect(result).toContain('data-internal-link="true"');
      expect(result).toContain('href="note.md"');
      expect(result).toContain(">Note</a>");
    });

    it("adds internal-link class to .md links with path", () => {
      const result = markdownToHtml("[Guide](docs/guide.md)");
      expect(result).toContain('class="internal-link"');
      expect(result).toContain('href="docs/guide.md"');
    });

    it("adds internal-link class to .md links with heading anchor", () => {
      const result = markdownToHtml("[Section](note.md#intro)");
      expect(result).toContain('class="internal-link"');
      expect(result).toContain('href="note.md#intro"');
    });

    it("does not add internal-link class to external links", () => {
      const result = markdownToHtml("[Example](https://example.com)");
      expect(result).not.toContain("internal-link");
      expect(result).not.toContain("data-internal-link");
    });

    it("does not add internal-link class to non-md files", () => {
      const result = markdownToHtml("[Image](photo.png)");
      expect(result).not.toContain("internal-link");
    });

    it("handles multiple internal links in same paragraph", () => {
      const result = markdownToHtml("Link to [A](a.md) and [B](b.md)");
      expect(result).toContain('href="a.md" class="internal-link"');
      expect(result).toContain('href="b.md" class="internal-link"');
    });

    it("handles mixed internal and external links", () => {
      const result = markdownToHtml(
        "See [note](note.md) and [web](https://example.com)"
      );
      const internalMatch = result.match(/<a href="note\.md"[^>]*>/);
      const externalMatch = result.match(/<a href="https:\/\/example\.com"[^>]*>/);

      expect(internalMatch?.[0]).toContain("internal-link");
      expect(externalMatch?.[0]).not.toContain("internal-link");
    });
  });

  describe("images", () => {
    it("converts image", () => {
      expect(markdownToHtml("![Alt text](image.png)")).toBe(
        '<p><img src="image.png" alt="Alt text" /></p>'
      );
    });

    it("converts image without alt", () => {
      expect(markdownToHtml("![](image.png)")).toBe(
        '<p><img src="image.png" alt="" /></p>'
      );
    });
  });

  describe("lists", () => {
    it("converts unordered list with dashes", () => {
      const md = "- Item 1\n- Item 2";
      const result = markdownToHtml(md);
      expect(result).toContain("<ul>");
      expect(result).toContain("<li>Item 1</li>");
      expect(result).toContain("<li>Item 2</li>");
      expect(result).toContain("</ul>");
    });

    it("converts unordered list with asterisks", () => {
      const md = "* Item 1\n* Item 2";
      const result = markdownToHtml(md);
      expect(result).toContain("<ul>");
      expect(result).toContain("<li>Item 1</li>");
    });

    it("converts ordered list", () => {
      const md = "1. First\n2. Second";
      const result = markdownToHtml(md);
      expect(result).toContain("<ol>");
      expect(result).toContain("<li>First</li>");
      expect(result).toContain("<li>Second</li>");
      expect(result).toContain("</ol>");
    });

    it("converts task list", () => {
      const md = "- [ ] Todo\n- [x] Done";
      const result = markdownToHtml(md);
      expect(result).toContain("<input");
      expect(result).toContain('type="checkbox"');
      expect(result).toContain("checked");
    });
  });

  describe("blockquotes", () => {
    it("converts blockquote", () => {
      const md = "> Quote";
      const result = markdownToHtml(md);
      expect(result).toContain("<blockquote>");
      expect(result).toContain("Quote");
      expect(result).toContain("</blockquote>");
    });
  });

  describe("code blocks", () => {
    it("converts code block without language", () => {
      const md = "```\nconst x = 1;\n```";
      const result = markdownToHtml(md);
      expect(result).toContain("<pre><code>");
      expect(result).toContain("const x = 1;");
      expect(result).toContain("</code></pre>");
    });

    it("converts code block with language", () => {
      const md = "```javascript\nconst x = 1;\n```";
      const result = markdownToHtml(md);
      expect(result).toContain('class="language-javascript"');
      expect(result).toContain("const x = 1;");
    });

    it("escapes HTML in code blocks", () => {
      const md = "```\n<script>alert('xss')</script>\n```";
      const result = markdownToHtml(md);
      expect(result).toContain("&lt;script&gt;");
      expect(result).not.toContain("<script>");
    });
  });

  describe("horizontal rule", () => {
    it("converts hr with dashes", () => {
      expect(markdownToHtml("---")).toBe("<hr />");
    });

    it("converts hr with asterisks", () => {
      expect(markdownToHtml("***")).toBe("<hr />");
    });
  });

  describe("tables", () => {
    it("converts simple table", () => {
      const md = "| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |";
      const result = markdownToHtml(md);
      expect(result).toContain("<table>");
      expect(result).toContain("<th>Header 1</th>");
      expect(result).toContain("<th>Header 2</th>");
      expect(result).toContain("<td>Cell 1</td>");
      expect(result).toContain("<td>Cell 2</td>");
      expect(result).toContain("</table>");
    });
  });

  describe("complex documents", () => {
    it("converts document with multiple elements", () => {
      const md = `# Title

Introduction paragraph.

## Section

- Item 1
- Item 2

\`\`\`javascript
const x = 1;
\`\`\`
`;
      const result = markdownToHtml(md);
      expect(result).toContain('<h1 id="title">Title</h1>');
      expect(result).toContain("<p>Introduction paragraph.</p>");
      expect(result).toContain('<h2 id="section">Section</h2>');
      expect(result).toContain("<li>Item 1</li>");
      expect(result).toContain('class="language-javascript"');
    });
  });
});
