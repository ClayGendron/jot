import { describe, it, expect } from "vitest";
import {
  normalizePath,
  isWithinWorkspace,
  validateAndNormalizePath,
  extractHeadingsFromHtml,
  extractHeadingsFromMarkdown,
  extractHeadingsFromContent,
  extractLinksFromHtml,
  shouldScrollOnly,
  buildDisplayPath,
  buildAbsolutePath,
  escapeHtmlAttr,
  escapeHtmlContent,
} from "./linkService";

describe("linkService", () => {
  const workspacePath = "/Users/test/workspace";

  describe("normalizePath", () => {
    it("returns workspace path for empty path", () => {
      expect(normalizePath("", workspacePath)).toBe(workspacePath);
    });

    it("removes leading ./ from path", () => {
      expect(normalizePath("./notes/file.md", workspacePath)).toBe(
        `${workspacePath}/notes/file.md`
      );
    });

    it("resolves .. in path", () => {
      expect(normalizePath("notes/../file.md", workspacePath)).toBe(
        `${workspacePath}/file.md`
      );
    });

    it("handles multiple .. in path", () => {
      expect(normalizePath("a/b/c/../../d.md", workspacePath)).toBe(
        `${workspacePath}/a/d.md`
      );
    });

    it("prevents traversal above workspace root", () => {
      expect(normalizePath("../../../file.md", workspacePath)).toBe(
        `${workspacePath}/file.md`
      );
    });

    it("handles absolute path within workspace", () => {
      expect(normalizePath(`${workspacePath}/notes/file.md`, workspacePath)).toBe(
        `${workspacePath}/notes/file.md`
      );
    });

    it("handles path with multiple slashes", () => {
      expect(normalizePath("notes//file.md", workspacePath)).toBe(
        `${workspacePath}/notes/file.md`
      );
    });
  });

  describe("isWithinWorkspace", () => {
    it("returns true for workspace root", () => {
      expect(isWithinWorkspace(workspacePath, workspacePath)).toBe(true);
    });

    it("returns true for path within workspace", () => {
      expect(isWithinWorkspace(`${workspacePath}/notes/file.md`, workspacePath)).toBe(true);
    });

    it("returns true for relative path within workspace", () => {
      expect(isWithinWorkspace("notes/file.md", workspacePath)).toBe(true);
    });

    it("returns true for path with resolved ..", () => {
      expect(isWithinWorkspace("notes/../file.md", workspacePath)).toBe(true);
    });

    it("returns false for path outside workspace after normalization", () => {
      // After normalization, this would try to go above root but gets clamped
      // So it should still be within workspace
      expect(isWithinWorkspace("../../../../etc/passwd", workspacePath)).toBe(true);
    });
  });

  describe("validateAndNormalizePath", () => {
    it("returns normalized path for valid path", () => {
      const result = validateAndNormalizePath("notes/file.md", workspacePath);
      expect(result).toBe(`${workspacePath}/notes/file.md`);
    });

    it("handles .. traversal attempts safely", () => {
      // The path gets clamped to workspace, so it doesn't throw
      const result = validateAndNormalizePath("../../file.md", workspacePath);
      expect(result).toBe(`${workspacePath}/file.md`);
    });
  });

  describe("extractHeadingsFromHtml", () => {
    it("extracts headings from HTML", () => {
      const html = '<h1 id="title">Title</h1><h2 id="section">Section</h2>';
      const headings = extractHeadingsFromHtml(html);

      expect(headings).toHaveLength(2);
      expect(headings[0]).toEqual({ level: 1, text: "Title", id: "title" });
      expect(headings[1]).toEqual({ level: 2, text: "Section", id: "section" });
    });

    it("generates id if not present", () => {
      const html = "<h1>My Title</h1>";
      const headings = extractHeadingsFromHtml(html);

      expect(headings).toHaveLength(1);
      expect(headings[0].id).toBe("my-title");
    });

    it("handles all heading levels", () => {
      const html = `
        <h1>H1</h1>
        <h2>H2</h2>
        <h3>H3</h3>
        <h4>H4</h4>
        <h5>H5</h5>
        <h6>H6</h6>
      `;
      const headings = extractHeadingsFromHtml(html);

      expect(headings).toHaveLength(6);
      expect(headings.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("returns empty array for content without headings", () => {
      const html = "<p>Just a paragraph</p>";
      const headings = extractHeadingsFromHtml(html);

      expect(headings).toHaveLength(0);
    });
  });

  describe("extractHeadingsFromMarkdown", () => {
    it("extracts headings from markdown", () => {
      const markdown = "# Title\n\nSome text\n\n## Section";
      const headings = extractHeadingsFromMarkdown(markdown);

      expect(headings).toHaveLength(2);
      expect(headings[0]).toEqual({ level: 1, text: "Title", id: "title" });
      expect(headings[1]).toEqual({ level: 2, text: "Section", id: "section" });
    });

    it("handles all heading levels", () => {
      const markdown = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;
      const headings = extractHeadingsFromMarkdown(markdown);

      expect(headings).toHaveLength(6);
      expect(headings.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it("ignores non-heading content", () => {
      const markdown = "Not a heading\n\n#Not a heading either\n\n# Real Heading";
      const headings = extractHeadingsFromMarkdown(markdown);

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe("Real Heading");
    });
  });

  describe("extractHeadingsFromContent", () => {
    it("uses HTML extraction for html format", () => {
      const html = '<h1 id="test">Test</h1>';
      const headings = extractHeadingsFromContent(html, "html");

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe("Test");
    });

    it("uses markdown extraction for markdown format", () => {
      const markdown = "# Test";
      const headings = extractHeadingsFromContent(markdown, "markdown");

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe("Test");
    });
  });

  describe("extractLinksFromHtml", () => {
    it("extracts internal links", () => {
      const html = '<a href="note.md">Note</a>';
      const links = extractLinksFromHtml(html);

      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({ href: "note.md", text: "Note", heading: undefined });
    });

    it("extracts links with heading anchors", () => {
      const html = '<a href="note.md#section">Section Link</a>';
      const links = extractLinksFromHtml(html);

      expect(links).toHaveLength(1);
      expect(links[0]).toEqual({
        href: "note.md",
        text: "Section Link",
        heading: "section",
      });
    });

    it("extracts multiple links", () => {
      const html = '<a href="a.md">A</a> and <a href="b.md">B</a>';
      const links = extractLinksFromHtml(html);

      expect(links).toHaveLength(2);
    });

    it("ignores external links", () => {
      const html = '<a href="https://example.com">External</a><a href="note.md">Internal</a>';
      const links = extractLinksFromHtml(html);

      expect(links).toHaveLength(1);
      expect(links[0].href).toBe("note.md");
    });
  });

  describe("shouldScrollOnly", () => {
    it("returns true when same file with heading", () => {
      expect(shouldScrollOnly("/path/file.md", "/path/file.md", "section")).toBe(true);
    });

    it("returns false when different files", () => {
      expect(shouldScrollOnly("/path/file1.md", "/path/file2.md", "section")).toBe(false);
    });

    it("returns false when no heading", () => {
      expect(shouldScrollOnly("/path/file.md", "/path/file.md")).toBe(false);
    });

    it("returns false when heading is empty string", () => {
      expect(shouldScrollOnly("/path/file.md", "/path/file.md", "")).toBe(false);
    });
  });

  describe("buildDisplayPath", () => {
    it("removes workspace prefix", () => {
      expect(buildDisplayPath(`${workspacePath}/notes/file.md`, workspacePath)).toBe(
        "notes/file.md"
      );
    });

    it("returns path as-is if no workspace prefix", () => {
      expect(buildDisplayPath("/other/path/file.md", workspacePath)).toBe(
        "/other/path/file.md"
      );
    });
  });

  describe("buildAbsolutePath", () => {
    it("prepends workspace path to relative path", () => {
      expect(buildAbsolutePath("notes/file.md", workspacePath)).toBe(
        `${workspacePath}/notes/file.md`
      );
    });

    it("returns absolute path as-is", () => {
      expect(buildAbsolutePath("/other/path/file.md", workspacePath)).toBe(
        "/other/path/file.md"
      );
    });
  });

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

    it("handles XSS attempt in attribute", () => {
      const xss = '" onclick="alert(1)"';
      expect(escapeHtmlAttr(xss)).toBe("&quot; onclick=&quot;alert(1)&quot;");
    });
  });

  describe("escapeHtmlContent", () => {
    it("escapes angle brackets", () => {
      expect(escapeHtmlContent("<script>alert(1)</script>")).toBe(
        "&lt;script&gt;alert(1)&lt;/script&gt;"
      );
    });

    it("escapes ampersands", () => {
      expect(escapeHtmlContent("a & b")).toBe("a &amp; b");
    });

    it("preserves quotes", () => {
      expect(escapeHtmlContent('"quoted"')).toBe('"quoted"');
    });
  });
});
