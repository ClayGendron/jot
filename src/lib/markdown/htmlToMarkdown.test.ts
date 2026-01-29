import { describe, it, expect } from "vitest";
import { htmlToMarkdown } from "./htmlToMarkdown";

describe("htmlToMarkdown", () => {
  describe("empty/null input", () => {
    it("returns empty string for empty input", () => {
      expect(htmlToMarkdown("")).toBe("");
    });

    it("returns empty string for empty paragraph", () => {
      expect(htmlToMarkdown("<p></p>")).toBe("");
    });
  });

  describe("headings", () => {
    it("converts h1 to markdown", () => {
      expect(htmlToMarkdown("<h1>Title</h1>")).toBe("# Title");
    });

    it("converts h2 to markdown", () => {
      expect(htmlToMarkdown("<h2>Subtitle</h2>")).toBe("## Subtitle");
    });

    it("converts h3 to markdown", () => {
      expect(htmlToMarkdown("<h3>Section</h3>")).toBe("### Section");
    });

    it("converts h4 to markdown", () => {
      expect(htmlToMarkdown("<h4>Subsection</h4>")).toBe("#### Subsection");
    });

    it("converts h5 to markdown", () => {
      expect(htmlToMarkdown("<h5>Minor</h5>")).toBe("##### Minor");
    });

    it("converts h6 to markdown", () => {
      expect(htmlToMarkdown("<h6>Smallest</h6>")).toBe("###### Smallest");
    });
  });

  describe("paragraphs", () => {
    it("converts simple paragraph", () => {
      expect(htmlToMarkdown("<p>Hello world</p>")).toBe("Hello world");
    });

    it("converts multiple paragraphs", () => {
      expect(htmlToMarkdown("<p>First</p><p>Second</p>")).toBe(
        "First\n\nSecond"
      );
    });
  });

  describe("inline formatting", () => {
    it("converts bold", () => {
      expect(htmlToMarkdown("<p><strong>bold</strong></p>")).toBe("**bold**");
    });

    it("converts italic", () => {
      expect(htmlToMarkdown("<p><em>italic</em></p>")).toBe("*italic*");
    });

    it("converts strikethrough", () => {
      expect(htmlToMarkdown("<p><s>deleted</s></p>")).toBe("~~deleted~~");
    });

    it("converts inline code", () => {
      expect(htmlToMarkdown("<p><code>code</code></p>")).toBe("`code`");
    });

    it("converts nested formatting", () => {
      expect(htmlToMarkdown("<p><strong><em>bold italic</em></strong></p>")).toBe(
        "***bold italic***"
      );
    });
  });

  describe("links", () => {
    it("converts link", () => {
      expect(
        htmlToMarkdown('<p><a href="https://example.com">Link</a></p>')
      ).toBe("[Link](https://example.com)");
    });

    it("converts link with empty href", () => {
      const result = htmlToMarkdown("<p><a>Link</a></p>");
      // Turndown may output just the text or [Link]()
      expect(result).toContain("Link");
    });
  });

  describe("images", () => {
    it("converts image", () => {
      expect(
        htmlToMarkdown('<img src="image.png" alt="Alt text" />')
      ).toBe("![Alt text](image.png)");
    });

    it("converts image without alt", () => {
      expect(htmlToMarkdown('<img src="image.png" />')).toBe("![](image.png)");
    });
  });

  describe("lists", () => {
    it("converts unordered list", () => {
      const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const result = htmlToMarkdown(html);
      expect(result).toContain("Item 1");
      expect(result).toContain("Item 2");
      expect(result).toMatch(/^[-*]\s+Item 1/m); // Accepts - or *
    });

    it("converts ordered list", () => {
      const html = "<ol><li>First</li><li>Second</li></ol>";
      const result = htmlToMarkdown(html);
      expect(result).toContain("First");
      expect(result).toContain("Second");
      expect(result).toMatch(/1\.\s+First/);
      expect(result).toMatch(/2\.\s+Second/);
    });

    it("converts nested list", () => {
      const html =
        "<ul><li>Parent<ul><li>Child</li></ul></li></ul>";
      const result = htmlToMarkdown(html);
      expect(result).toContain("Parent");
      expect(result).toContain("Child");
    });
  });

  describe("blockquotes", () => {
    it("converts simple blockquote", () => {
      expect(htmlToMarkdown("<blockquote><p>Quote</p></blockquote>")).toBe(
        "> Quote"
      );
    });

    it("converts multi-line blockquote", () => {
      const html =
        "<blockquote><p>Line 1</p><p>Line 2</p></blockquote>";
      const result = htmlToMarkdown(html);
      expect(result).toContain("> Line 1");
    });
  });

  describe("code blocks", () => {
    it("converts code block without language", () => {
      const html = "<pre><code>const x = 1;</code></pre>";
      expect(htmlToMarkdown(html)).toBe("```\nconst x = 1;\n```");
    });

    it("converts code block with language", () => {
      const html =
        '<pre><code class="language-javascript">const x = 1;</code></pre>';
      expect(htmlToMarkdown(html)).toBe("```javascript\nconst x = 1;\n```");
    });
  });

  describe("horizontal rule", () => {
    it("converts hr", () => {
      expect(htmlToMarkdown("<hr />")).toBe("---");
    });
  });

  describe("tables", () => {
    it("converts simple table", () => {
      const html = `
        <table>
          <tr><th>Header 1</th><th>Header 2</th></tr>
          <tr><td>Cell 1</td><td>Cell 2</td></tr>
        </table>
      `;
      const result = htmlToMarkdown(html);
      expect(result).toContain("| Header 1 | Header 2 |");
      expect(result).toContain("| --- | --- |");
      expect(result).toContain("| Cell 1 | Cell 2 |");
    });
  });

  describe("complex documents", () => {
    it("converts document with multiple elements", () => {
      const html = `
        <h1>Title</h1>
        <p>Introduction paragraph.</p>
        <h2>Section</h2>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `;
      const result = htmlToMarkdown(html);
      expect(result).toContain("# Title");
      expect(result).toContain("Introduction paragraph.");
      expect(result).toContain("## Section");
      expect(result).toContain("Item 1");
      expect(result).toMatch(/[-*]\s+Item 1/); // Accepts - or *
    });
  });
});
