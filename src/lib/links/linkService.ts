/**
 * Link Service
 *
 * Centralized APIs for internal link management.
 * Provides path validation, heading extraction, and navigation helpers.
 */

import { generateHeadingId, type Heading } from "@/lib/markdown/parser";

/**
 * Represents an internal link extracted from content
 */
export interface InternalLink {
  href: string;
  text: string;
  heading?: string;
}

/**
 * Normalize a path relative to the workspace
 * Resolves relative paths like ../foo and ./bar
 */
export function normalizePath(path: string, workspacePath: string): string {
  // Handle empty or null paths
  if (!path) return workspacePath;

  // If already absolute and within workspace, normalize it
  if (path.startsWith(workspacePath)) {
    return normalizePath(path.slice(workspacePath.length + 1), workspacePath);
  }

  // Handle leading ./
  if (path.startsWith("./")) {
    path = path.slice(2);
  }

  // Split into parts and resolve .. and .
  const parts = path.split("/").filter(Boolean);
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "..") {
      // Can't go above workspace root
      if (resolved.length > 0) {
        resolved.pop();
      }
    } else if (part !== ".") {
      resolved.push(part);
    }
  }

  // Join back with workspace path
  return resolved.length > 0
    ? `${workspacePath}/${resolved.join("/")}`
    : workspacePath;
}

/**
 * Check if a path is within the workspace (security check for path traversal)
 */
export function isWithinWorkspace(
  path: string,
  workspacePath: string
): boolean {
  // Normalize both paths for consistent comparison
  const normalizedPath = normalizePath(path, workspacePath);
  const normalizedWorkspace = workspacePath.replace(/\/+$/, "");

  // The normalized path must start with the workspace path
  return (
    normalizedPath === normalizedWorkspace ||
    normalizedPath.startsWith(normalizedWorkspace + "/")
  );
}

/**
 * Validate that a path doesn't escape the workspace
 * Returns the normalized path if valid, throws if invalid
 */
export function validateAndNormalizePath(
  path: string,
  workspacePath: string
): string {
  const normalized = normalizePath(path, workspacePath);
  if (!isWithinWorkspace(normalized, workspacePath)) {
    throw new Error(`Path "${path}" is outside workspace`);
  }
  return normalized;
}

/**
 * Extract headings from HTML content (for editor content)
 */
export function extractHeadingsFromHtml(html: string): Heading[] {
  const headings: Heading[] = [];

  // Match heading tags with their content
  const headingRegex = /<h([1-6])(?:\s+id="([^"]*)")?[^>]*>([^<]*)<\/h\1>/gi;
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1], 10) as 1 | 2 | 3 | 4 | 5 | 6;
    const existingId = match[2];
    const text = match[3].trim();
    const id = existingId || generateHeadingId(text);

    headings.push({ level, text, id });
  }

  return headings;
}

/**
 * Extract headings from Markdown content (for file content on disk)
 */
export function extractHeadingsFromMarkdown(markdown: string): Heading[] {
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
 * Extract headings from content, detecting format automatically
 */
export function extractHeadingsFromContent(
  content: string,
  format: "html" | "markdown"
): Heading[] {
  return format === "html"
    ? extractHeadingsFromHtml(content)
    : extractHeadingsFromMarkdown(content);
}

/**
 * Extract internal links from HTML content
 */
export function extractLinksFromHtml(html: string): InternalLink[] {
  const links: InternalLink[] = [];

  // Match anchor tags with data-internal-link attribute or .md href
  const linkRegex =
    /<a\s+[^>]*href="([^"]*\.md(?:#[^"]*)?)"[^>]*>([^<]*)<\/a>/gi;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1];
    const text = match[2];
    const [, heading] = href.split("#");

    links.push({
      href: href.split("#")[0], // Remove anchor for file path
      text,
      heading,
    });
  }

  return links;
}

/**
 * Check if navigation should be scroll-only (same file heading navigation)
 */
export function shouldScrollOnly(
  targetPath: string,
  currentPath: string,
  heading?: string
): boolean {
  // Must have a heading to scroll to
  if (!heading) return false;

  // Compare paths (normalize both to handle trailing slashes etc)
  return targetPath === currentPath;
}

/**
 * Build a display path from an absolute path and workspace path
 */
export function buildDisplayPath(
  absolutePath: string,
  workspacePath: string
): string {
  if (absolutePath.startsWith(workspacePath + "/")) {
    return absolutePath.slice(workspacePath.length + 1);
  }
  return absolutePath;
}

/**
 * Build an absolute path from a relative path and workspace path
 */
export function buildAbsolutePath(
  relativePath: string,
  workspacePath: string
): string {
  if (relativePath.startsWith("/")) {
    return relativePath;
  }
  return `${workspacePath}/${relativePath}`;
}

/**
 * Escape text for safe use in HTML attributes
 */
export function escapeHtmlAttr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escape text for safe use in HTML content
 */
export function escapeHtmlContent(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
