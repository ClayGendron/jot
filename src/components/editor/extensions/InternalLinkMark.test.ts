import { describe, it, expect } from "vitest";
import { escapeHtmlAttr, escapeHtmlContent } from "@/lib/links/linkService";

/**
 * Tests for InternalLinkMark extension
 *
 * Note: Testing TipTap extensions in isolation is complex because different
 * environments parse HTML differently. These tests focus on the HTML escaping
 * functions that power safe link insertion.
 *
 * Integration tests with the full editor setup would be better done
 * as E2E tests with Playwright.
 */

describe("InternalLinkMark extension - HTML escaping", () => {
  describe("escapeHtmlAttr", () => {
    it("escapes double quotes", () => {
      expect(escapeHtmlAttr('test"value')).toBe("test&quot;value");
    });

    it("escapes single quotes", () => {
      expect(escapeHtmlAttr("test'value")).toBe("test&#39;value");
    });

    it("escapes ampersands", () => {
      expect(escapeHtmlAttr("test&value")).toBe("test&amp;value");
    });

    it("escapes angle brackets", () => {
      expect(escapeHtmlAttr("test<>value")).toBe("test&lt;&gt;value");
    });

    it("handles XSS attempt in href", () => {
      const xss = 'javascript:alert("XSS")';
      const escaped = escapeHtmlAttr(xss);
      expect(escaped).not.toContain('"');
      expect(escaped).toContain("&quot;");
    });

    it("handles XSS attempt with event handler", () => {
      const xss = '" onclick="alert(1)"';
      const escaped = escapeHtmlAttr(xss);
      expect(escaped).toBe("&quot; onclick=&quot;alert(1)&quot;");
    });
  });

  describe("escapeHtmlContent", () => {
    it("escapes script tags", () => {
      const xss = "<script>alert(1)</script>";
      expect(escapeHtmlContent(xss)).toBe(
        "&lt;script&gt;alert(1)&lt;/script&gt;"
      );
    });

    it("escapes HTML entities in link text", () => {
      const text = "A & B < C > D";
      expect(escapeHtmlContent(text)).toBe("A &amp; B &lt; C &gt; D");
    });

    it("preserves quotes in content", () => {
      expect(escapeHtmlContent('"quoted"')).toBe('"quoted"');
      expect(escapeHtmlContent("'single'")).toBe("'single'");
    });
  });
});

describe("InternalLinkMark - safe link construction", () => {
  it("constructs safe link HTML from user input", () => {
    const href = 'note"malicious.md';
    const text = "<script>alert(1)</script>";

    const safeHref = escapeHtmlAttr(href);
    const safeText = escapeHtmlContent(text);

    const html = `<a href="${safeHref}" class="internal-link" data-internal-link="true">${safeText}</a>`;

    // Should not contain raw quotes or script tags
    expect(html).not.toContain('note"malicious');
    expect(html).toContain("note&quot;malicious");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
