import { describe, it, expect } from "vitest";
import {
  generateHeadingId,
  extractHeadings,
  countWords,
  countCharacters,
  estimateReadingTime,
  convertWikiLinks,
  convertToWikiLinks,
  extractInternalLinks,
} from "./parser";

describe("generateHeadingId", () => {
  it("converts text to lowercase kebab-case", () => {
    expect(generateHeadingId("Hello World")).toBe("hello-world");
  });

  it("removes special characters", () => {
    expect(generateHeadingId("Hello, World!")).toBe("hello-world");
  });

  it("handles multiple spaces", () => {
    expect(generateHeadingId("Hello   World")).toBe("hello-world");
  });

  it("removes leading and trailing hyphens", () => {
    expect(generateHeadingId(" Hello World ")).toBe("hello-world");
  });

  it("handles numbers", () => {
    expect(generateHeadingId("Chapter 1: Introduction")).toBe(
      "chapter-1-introduction"
    );
  });
});

describe("extractHeadings", () => {
  it("extracts headings with levels", () => {
    const markdown = `# Title
## Section 1
### Subsection 1.1
## Section 2`;

    const headings = extractHeadings(markdown);

    expect(headings).toHaveLength(4);
    expect(headings[0]).toEqual({ level: 1, text: "Title", id: "title" });
    expect(headings[1]).toEqual({
      level: 2,
      text: "Section 1",
      id: "section-1",
    });
    expect(headings[2]).toEqual({
      level: 3,
      text: "Subsection 1.1",
      id: "subsection-11",
    });
  });

  it("handles empty markdown", () => {
    expect(extractHeadings("")).toEqual([]);
  });

  it("ignores non-heading content", () => {
    const markdown = `Some text
# Heading
More text`;

    const headings = extractHeadings(markdown);

    expect(headings).toHaveLength(1);
    expect(headings[0].text).toBe("Heading");
  });
});

describe("countWords", () => {
  it("counts words in plain text", () => {
    expect(countWords("Hello world")).toBe(2);
  });

  it("handles markdown formatting", () => {
    expect(countWords("**Bold** and *italic*")).toBe(3);
  });

  it("handles links", () => {
    expect(countWords("[Link text](https://example.com)")).toBe(2);
  });

  it("excludes code blocks", () => {
    const markdown = `Text before
\`\`\`javascript
const x = 1;
\`\`\`
Text after`;

    expect(countWords(markdown)).toBe(4); // "Text before Text after"
  });

  it("returns 0 for empty text", () => {
    expect(countWords("")).toBe(0);
  });

  it("handles whitespace-only text", () => {
    expect(countWords("   \n\t  ")).toBe(0);
  });
});

describe("countCharacters", () => {
  it("counts characters including spaces", () => {
    expect(countCharacters("Hello world")).toBe(11);
  });

  it("counts characters excluding spaces", () => {
    expect(countCharacters("Hello world", false)).toBe(10);
  });

  it("strips markdown formatting", () => {
    expect(countCharacters("**Bold**")).toBe(4);
  });
});

describe("estimateReadingTime", () => {
  it("calculates reading time at default WPM", () => {
    // 200 WPM default, so 400 words = 2 minutes
    const words = Array(400).fill("word").join(" ");
    expect(estimateReadingTime(words)).toBe(2);
  });

  it("rounds up to nearest minute", () => {
    // 201 words at 200 WPM = 2 minutes (rounded up)
    const words = Array(201).fill("word").join(" ");
    expect(estimateReadingTime(words)).toBe(2);
  });

  it("handles custom WPM", () => {
    const words = Array(300).fill("word").join(" ");
    expect(estimateReadingTime(words, 100)).toBe(3);
  });
});

describe("convertWikiLinks", () => {
  it("converts simple wiki link", () => {
    expect(convertWikiLinks("[[note]]")).toBe("[note](note.md)");
  });

  it("converts wiki link with display text", () => {
    expect(convertWikiLinks("[[note|Display Text]]")).toBe(
      "[Display Text](note.md)"
    );
  });

  it("converts wiki link with heading", () => {
    expect(convertWikiLinks("[[note#heading]]")).toBe("[note](note.md#heading)");
  });

  it("converts wiki link with heading and display text", () => {
    expect(convertWikiLinks("[[note#heading|Display]]")).toBe(
      "[Display](note.md#heading)"
    );
  });

  it("handles multiple links in text", () => {
    const input = "See [[note1]] and [[note2|other note]]";
    const expected = "See [note1](note1.md) and [other note](note2.md)";
    expect(convertWikiLinks(input)).toBe(expected);
  });
});

describe("convertToWikiLinks", () => {
  it("converts simple markdown link", () => {
    expect(convertToWikiLinks("[note](note.md)")).toBe("[[note]]");
  });

  it("converts link with different display text", () => {
    expect(convertToWikiLinks("[Display](note.md)")).toBe("[[note|Display]]");
  });

  it("converts link with heading", () => {
    expect(convertToWikiLinks("[text](note.md#heading)")).toBe(
      "[[note#heading|text]]"
    );
  });

  it("preserves external links", () => {
    expect(convertToWikiLinks("[text](https://example.com)")).toBe(
      "[text](https://example.com)"
    );
  });
});

describe("extractInternalLinks", () => {
  it("extracts wiki-style links", () => {
    const markdown = "See [[note1]] for more.";
    const links = extractInternalLinks(markdown);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: "note1",
      heading: undefined,
      displayText: undefined,
      raw: "[[note1]]",
    });
  });

  it("extracts markdown-style internal links", () => {
    const markdown = "See [My Note](my-note.md) for details.";
    const links = extractInternalLinks(markdown);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: "my-note",
      heading: undefined,
      displayText: "My Note",
      raw: "[My Note](my-note.md)",
    });
  });

  it("extracts links with headings", () => {
    const markdown = "Jump to [[note#section|the section]]";
    const links = extractInternalLinks(markdown);

    expect(links).toHaveLength(1);
    expect(links[0]).toEqual({
      target: "note",
      heading: "section",
      displayText: "the section",
      raw: "[[note#section|the section]]",
    });
  });

  it("extracts multiple links", () => {
    const markdown = "See [[note1]] and [Note 2](note2.md)";
    const links = extractInternalLinks(markdown);

    expect(links).toHaveLength(2);
  });
});
