/**
 * Markdown parsing utilities
 *
 * Pure functions for markdown transformations.
 * No side effects, easy to test.
 */

export interface ParseResult<T> {
  ok: true;
  value: T;
}

export interface ParseError {
  ok: false;
  error: string;
}

export type Result<T> = ParseResult<T> | ParseError;

/**
 * Extracts headings from markdown content for outline generation
 */
export interface Heading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
  id: string;
}

/**
 * Generate a URL-safe ID from heading text
 */
export function generateHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Extract headings from markdown text
 */
export function extractHeadings(markdown: string): Heading[] {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length as 1 | 2 | 3 | 4 | 5 | 6;
    const text = match[2].trim();
    const id = generateHeadingId(text);

    headings.push({ level, text, id });
  }

  return headings;
}

/**
 * Count words in text (handles markdown formatting)
 */
export function countWords(text: string): number {
  // Remove markdown syntax
  const plainText = text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`[^`]+`/g, "") // Remove inline code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Replace links with text
    .replace(/[#*_~`>\-|]/g, "") // Remove markdown symbols
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  if (!plainText) return 0;

  return plainText.split(/\s+/).filter((word) => word.length > 0).length;
}

/**
 * Count characters (excluding markdown syntax)
 */
export function countCharacters(text: string, includeSpaces = true): number {
  const plainText = text
    .replace(/```[\s\S]*?```/g, "") // Remove code blocks
    .replace(/`[^`]+`/g, (match) => match.slice(1, -1)) // Keep code content
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Replace links with text
    .replace(/[#*_~`>\-|]/g, ""); // Remove markdown symbols

  if (includeSpaces) {
    return plainText.length;
  }

  return plainText.replace(/\s/g, "").length;
}

/**
 * Estimate reading time in minutes
 */
export function estimateReadingTime(text: string, wordsPerMinute = 200): number {
  const words = countWords(text);
  return Math.ceil(words / wordsPerMinute);
}

/**
 * Convert internal wiki-style links [[note]] to standard markdown [note](note.md)
 */
export function convertWikiLinks(markdown: string): string {
  // [[note]] -> [note](note.md)
  // [[note|display]] -> [display](note.md)
  // [[note#heading]] -> [note](note.md#heading)
  // [[note#heading|display]] -> [display](note.md#heading)

  return markdown.replace(
    /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g,
    (_, note, heading, display) => {
      const linkText = display || note;
      const anchor = heading ? `#${generateHeadingId(heading)}` : "";
      const fileName = `${note.trim()}.md`;
      return `[${linkText}](${fileName}${anchor})`;
    }
  );
}

/**
 * Convert standard markdown links to wiki-style for storage
 */
export function convertToWikiLinks(markdown: string): string {
  // [text](file.md) -> [[file|text]] or [[file]] if text === file
  // [text](file.md#heading) -> [[file#heading|text]]

  return markdown.replace(
    /\[([^\]]+)\]\(([^)]+\.md)(#[^)]+)?\)/g,
    (_, text, file, anchor = "") => {
      const noteName = file.replace(/\.md$/, "");
      const heading = anchor.replace(/^#/, "");

      if (text === noteName && !heading) {
        return `[[${noteName}]]`;
      }

      if (heading) {
        return `[[${noteName}#${heading}|${text}]]`;
      }

      return `[[${noteName}|${text}]]`;
    }
  );
}

/**
 * Extract all internal links from markdown
 */
export interface InternalLink {
  target: string;
  heading?: string;
  displayText?: string;
  raw: string;
}

export function extractInternalLinks(markdown: string): InternalLink[] {
  const links: InternalLink[] = [];

  // Wiki-style links
  const wikiRegex = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
  let match;

  while ((match = wikiRegex.exec(markdown)) !== null) {
    links.push({
      target: match[1].trim(),
      heading: match[2]?.trim(),
      displayText: match[3]?.trim(),
      raw: match[0],
    });
  }

  // Standard markdown links to .md files
  const mdRegex = /\[([^\]]+)\]\(([^)]+\.md)(#[^)]+)?\)/g;

  while ((match = mdRegex.exec(markdown)) !== null) {
    links.push({
      target: match[2].replace(/\.md$/, ""),
      heading: match[3]?.replace(/^#/, ""),
      displayText: match[1],
      raw: match[0],
    });
  }

  return links;
}
