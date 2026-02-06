/**
 * Tests for WYSIWYG table cell formatting
 *
 * Tests that table cells:
 * - Always show rendered content (bold text, not **bold**)
 * - Convert HTML back to markdown on edit
 * - Support formatting keyboard shortcuts
 */

import { describe, it, expect } from "vitest";
import {
  renderInlineMarkdown,
  htmlToMarkdown,
  escapeHtml,
} from "../harness";

// ===========================================
// renderInlineMarkdown tests (markdown → HTML)
// ===========================================

describe("renderInlineMarkdown", () => {
  describe("bold formatting", () => {
    it("renders **bold** as <strong>", () => {
      const html = renderInlineMarkdown("**bold**");
      expect(html).toBe('<strong class="cm-strong">bold</strong>');
    });

    it("renders bold text in a sentence", () => {
      const html = renderInlineMarkdown("This is **bold** text");
      expect(html).toBe('This is <strong class="cm-strong">bold</strong> text');
    });

    it("renders multiple bold sections", () => {
      const html = renderInlineMarkdown("**one** and **two**");
      expect(html).toBe('<strong class="cm-strong">one</strong> and <strong class="cm-strong">two</strong>');
    });
  });

  describe("italic formatting", () => {
    it("renders *italic* as <em>", () => {
      const html = renderInlineMarkdown("*italic*");
      expect(html).toBe('<em class="cm-em">italic</em>');
    });

    it("renders italic text in a sentence", () => {
      const html = renderInlineMarkdown("This is *italic* text");
      expect(html).toBe('This is <em class="cm-em">italic</em> text');
    });
  });

  describe("inline code", () => {
    it("renders `code` as <code>", () => {
      const html = renderInlineMarkdown("`code`");
      expect(html).toBe('<code class="cm-inline-code">code</code>');
    });

    it("renders code in a sentence", () => {
      const html = renderInlineMarkdown("Use `const x = 1` here");
      expect(html).toBe('Use <code class="cm-inline-code">const x = 1</code> here');
    });

    it("preserves special characters inside code", () => {
      const html = renderInlineMarkdown("`**not bold**`");
      expect(html).toBe('<code class="cm-inline-code">**not bold**</code>');
    });
  });

  describe("strikethrough", () => {
    it("renders ~~strike~~ as <s>", () => {
      const html = renderInlineMarkdown("~~strike~~");
      expect(html).toBe('<s class="cm-strikethrough">strike</s>');
    });

    it("renders strikethrough in a sentence", () => {
      const html = renderInlineMarkdown("This is ~~deleted~~ text");
      expect(html).toBe('This is <s class="cm-strikethrough">deleted</s> text');
    });
  });

  describe("highlight", () => {
    it("renders ==highlight== as <mark>", () => {
      const html = renderInlineMarkdown("==highlight==");
      expect(html).toBe('<mark class="cm-highlight">highlight</mark>');
    });

    it("renders highlight in a sentence", () => {
      const html = renderInlineMarkdown("This is ==important== text");
      expect(html).toBe('This is <mark class="cm-highlight">important</mark> text');
    });
  });

  describe("links", () => {
    it("renders [text](url) as <a>", () => {
      const html = renderInlineMarkdown("[link](https://example.com)");
      expect(html).toBe('<a href="https://example.com" class="cm-link" rel="noopener noreferrer" target="_blank">link</a>');
    });

    it("renders links with special characters in URL", () => {
      const html = renderInlineMarkdown('[search](https://example.com?q="test")');
      expect(html).toBe('<a href="https://example.com?q=&quot;test&quot;" class="cm-link" rel="noopener noreferrer" target="_blank">search</a>');
    });

    it("renders link in a sentence", () => {
      const html = renderInlineMarkdown("Visit [example](https://example.com) site");
      expect(html).toBe('Visit <a href="https://example.com" class="cm-link" rel="noopener noreferrer" target="_blank">example</a> site');
    });
  });

  describe("mixed formatting", () => {
    it("renders bold and italic together", () => {
      const html = renderInlineMarkdown("**bold** and *italic*");
      expect(html).toContain('<strong class="cm-strong">bold</strong>');
      expect(html).toContain('<em class="cm-em">italic</em>');
    });

    it("renders multiple formatting types", () => {
      const html = renderInlineMarkdown("**bold** `code` *italic*");
      expect(html).toContain('<strong class="cm-strong">bold</strong>');
      expect(html).toContain('<code class="cm-inline-code">code</code>');
      expect(html).toContain('<em class="cm-em">italic</em>');
    });
  });

  describe("HTML escaping", () => {
    it("escapes < and >", () => {
      const html = renderInlineMarkdown("<script>alert('xss')</script>");
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("escapes &", () => {
      const html = renderInlineMarkdown("A & B");
      expect(html).toBe("A &amp; B");
    });
  });

  describe("empty and whitespace", () => {
    it("handles empty string", () => {
      const html = renderInlineMarkdown("");
      expect(html).toBe("");
    });

    it("handles whitespace only", () => {
      const html = renderInlineMarkdown("   ");
      expect(html).toBe("   ");
    });
  });
});

// ===========================================
// htmlToMarkdown tests (HTML → markdown)
// ===========================================

describe("htmlToMarkdown", () => {
  describe("bold conversion", () => {
    it("converts <strong> to **bold**", () => {
      const md = htmlToMarkdown('<strong class="cm-strong">bold</strong>');
      expect(md).toBe("**bold**");
    });

    it("converts <b> to **bold**", () => {
      const md = htmlToMarkdown("<b>bold</b>");
      expect(md).toBe("**bold**");
    });

    it("converts bold in sentence", () => {
      const md = htmlToMarkdown('This is <strong class="cm-strong">bold</strong> text');
      expect(md).toBe("This is **bold** text");
    });

    it("does not create empty bold markers", () => {
      const md = htmlToMarkdown("<strong></strong>");
      expect(md).toBe("");
    });
  });

  describe("italic conversion", () => {
    it("converts <em> to *italic*", () => {
      const md = htmlToMarkdown('<em class="cm-em">italic</em>');
      expect(md).toBe("*italic*");
    });

    it("converts <i> to *italic*", () => {
      const md = htmlToMarkdown("<i>italic</i>");
      expect(md).toBe("*italic*");
    });
  });

  describe("code conversion", () => {
    it("converts <code> to `code`", () => {
      const md = htmlToMarkdown('<code class="cm-inline-code">code</code>');
      expect(md).toBe("`code`");
    });

    it("converts code in sentence", () => {
      const md = htmlToMarkdown('Use <code class="cm-inline-code">const x = 1</code> here');
      expect(md).toBe("Use `const x = 1` here");
    });
  });

  describe("strikethrough conversion", () => {
    it("converts <s> to ~~strike~~", () => {
      const md = htmlToMarkdown('<s class="cm-strikethrough">strike</s>');
      expect(md).toBe("~~strike~~");
    });

    it("converts <del> to ~~strike~~", () => {
      const md = htmlToMarkdown("<del>strike</del>");
      expect(md).toBe("~~strike~~");
    });

    it("converts <strike> to ~~strike~~", () => {
      const md = htmlToMarkdown("<strike>strike</strike>");
      expect(md).toBe("~~strike~~");
    });
  });

  describe("highlight conversion", () => {
    it("converts <mark> to ==highlight==", () => {
      const md = htmlToMarkdown('<mark class="cm-highlight">highlight</mark>');
      expect(md).toBe("==highlight==");
    });
  });

  describe("link conversion", () => {
    it("converts <a> to [text](url)", () => {
      const md = htmlToMarkdown('<a href="https://example.com" class="cm-link">link</a>');
      expect(md).toBe("[link](https://example.com)");
    });

    it("handles empty href", () => {
      const md = htmlToMarkdown('<a href="" class="cm-link">link</a>');
      expect(md).toBe("[link]()");
    });

    it("handles link in sentence", () => {
      const md = htmlToMarkdown('Visit <a href="https://example.com" class="cm-link">example</a> site');
      expect(md).toBe("Visit [example](https://example.com) site");
    });
  });

  describe("nested formatting", () => {
    it("converts nested bold+italic (strong inside em)", () => {
      const md = htmlToMarkdown("<em><strong>bold italic</strong></em>");
      expect(md).toBe("***bold italic***");
    });

    it("converts nested italic+bold (em inside strong)", () => {
      const md = htmlToMarkdown("<strong><em>bold italic</em></strong>");
      expect(md).toBe("***bold italic***");
    });
  });

  describe("HTML entity decoding", () => {
    it("decodes &amp;", () => {
      const md = htmlToMarkdown("A &amp; B");
      expect(md).toBe("A & B");
    });

    it("decodes &lt; and &gt;", () => {
      const md = htmlToMarkdown("&lt;tag&gt;");
      expect(md).toBe("<tag>");
    });

    it("decodes &quot;", () => {
      const md = htmlToMarkdown('Say &quot;hello&quot;');
      expect(md).toBe('Say "hello"');
    });

    it("decodes &nbsp;", () => {
      const md = htmlToMarkdown("a&nbsp;b");
      // &nbsp; becomes non-breaking space (U+00A0) which we convert to regular space
      expect(md).toBe("a b");
    });
  });

  describe("br handling", () => {
    it("removes <br> tags", () => {
      const md = htmlToMarkdown("line1<br>line2");
      expect(md).toBe("line1line2");
    });

    it("removes <br /> tags", () => {
      const md = htmlToMarkdown("line1<br />line2");
      expect(md).toBe("line1line2");
    });
  });

  describe("plain text", () => {
    it("handles plain text", () => {
      const md = htmlToMarkdown("plain text");
      expect(md).toBe("plain text");
    });

    it("handles empty string", () => {
      const md = htmlToMarkdown("");
      expect(md).toBe("");
    });

    it("handles whitespace", () => {
      const md = htmlToMarkdown("   ");
      expect(md).toBe("   ");
    });
  });

  describe("unknown tags", () => {
    it("extracts content from unknown tags", () => {
      const md = htmlToMarkdown("<span>content</span>");
      expect(md).toBe("content");
    });

    it("extracts content from nested unknown tags", () => {
      const md = htmlToMarkdown("<div><span>content</span></div>");
      expect(md).toBe("content");
    });
  });
});

// ===========================================
// Round-trip tests (markdown → HTML → markdown)
// ===========================================

describe("round-trip conversion", () => {
  const roundTrip = (md: string) => htmlToMarkdown(renderInlineMarkdown(md));

  it("preserves bold", () => {
    expect(roundTrip("**bold**")).toBe("**bold**");
  });

  it("preserves italic", () => {
    expect(roundTrip("*italic*")).toBe("*italic*");
  });

  it("preserves code", () => {
    expect(roundTrip("`code`")).toBe("`code`");
  });

  it("preserves strikethrough", () => {
    expect(roundTrip("~~strike~~")).toBe("~~strike~~");
  });

  it("preserves highlight", () => {
    expect(roundTrip("==highlight==")).toBe("==highlight==");
  });

  it("preserves links", () => {
    expect(roundTrip("[link](https://example.com)")).toBe("[link](https://example.com)");
  });

  it("preserves plain text", () => {
    expect(roundTrip("plain text")).toBe("plain text");
  });

  it("preserves mixed formatting", () => {
    const input = "**bold** and *italic* and `code`";
    const output = roundTrip(input);
    expect(output).toContain("**bold**");
    expect(output).toContain("*italic*");
    expect(output).toContain("`code`");
  });

  it("preserves text with special characters", () => {
    expect(roundTrip("A & B < C > D")).toBe("A & B < C > D");
  });
});

// ===========================================
// escapeHtml tests
// ===========================================

describe("escapeHtml", () => {
  it("escapes &", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("escapes <", () => {
    expect(escapeHtml("<tag>")).toBe("&lt;tag&gt;");
  });

  it("escapes >", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it('escapes "', () => {
    expect(escapeHtml('"quote"')).toBe("&quot;quote&quot;");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("handles no special characters", () => {
    expect(escapeHtml("plain text")).toBe("plain text");
  });
});
