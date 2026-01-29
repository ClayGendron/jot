/**
 * Markdown to HTML converter
 *
 * Uses markdown-it for robust, CommonMark-compliant conversion.
 * Configured for TipTap compatibility with internal link support.
 */

import MarkdownIt from "markdown-it";
// @ts-expect-error - no types available for markdown-it-task-lists
import taskLists from "markdown-it-task-lists";
import { isInternalLink } from "../links/resolver";
import { generateHeadingId } from "./parser";

// Create markdown-it instance with HTML enabled for flexibility
const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  xhtmlOut: true, // Use self-closing tags like <hr /> and <img />
});

// Enable task list support
md.use(taskLists, { enabled: true, label: true, labelAfter: false });

// Custom renderer for links - adds internal link attributes
const defaultLinkRender =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  const hrefIndex = token.attrIndex("href");

  if (hrefIndex >= 0 && token.attrs) {
    const href = token.attrs[hrefIndex][1];
    if (isInternalLink(href)) {
      token.attrPush(["class", "internal-link"]);
      token.attrPush(["data-internal-link", "true"]);
    }
  }

  return defaultLinkRender(tokens, idx, options, env, self);
};

// Custom renderer for headings - adds IDs for navigation
md.renderer.rules.heading_open = function (tokens, idx) {
  const token = tokens[idx];
  const level = token.tag; // h1, h2, etc.

  // Get the heading text from the next token (inline content)
  const contentToken = tokens[idx + 1];
  const text = contentToken?.children
    ?.map((child) => child.content)
    .join("") || "";

  const id = generateHeadingId(text);
  return `<${level} id="${id}">`;
};

/**
 * Convert Markdown string to HTML
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "<p></p>";

  // Use markdown-it to render
  let html = md.render(markdown);

  // Clean up any extra whitespace
  html = html.trim();

  // Ensure we always return something TipTap can work with
  if (!html) return "<p></p>";

  return html;
}

export default markdownToHtml;
