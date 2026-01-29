/**
 * Backlinks index and query functionality
 *
 * Pure functions for building and querying a backlinks index.
 * The index maps file paths to the files that link to them.
 */

import { extractInternalLinks } from "@/lib/markdown/parser";

export interface BacklinkEntry {
  /** Path of the file containing the link */
  sourcePath: string;
  /** Display name of the source file */
  sourceName: string;
  /** The link text used (display text or target) */
  linkText: string;
  /** Context snippet around the link (optional) */
  context?: string;
}

export interface BacklinksIndex {
  /** Map from target file path to array of backlinks */
  [targetPath: string]: BacklinkEntry[];
}

export interface FileContent {
  path: string;
  name: string;
  content: string;
}

/**
 * Build a backlinks index from file contents
 * Returns a map from target file path to backlinks
 */
export function buildBacklinksIndex(
  files: FileContent[],
  workspacePath: string
): BacklinksIndex {
  const index: BacklinksIndex = {};

  for (const file of files) {
    const links = extractInternalLinks(file.content);

    for (const link of links) {
      // Resolve the target path
      const targetPath = resolveTargetPath(link.target, workspacePath);

      if (!index[targetPath]) {
        index[targetPath] = [];
      }

      index[targetPath].push({
        sourcePath: file.path,
        sourceName: file.name.replace(/\.md$/, ""),
        linkText: link.displayText || link.target,
        context: extractContext(file.content, link.raw),
      });
    }
  }

  return index;
}

/**
 * Get backlinks for a specific file
 */
export function getBacklinksForFile(
  index: BacklinksIndex,
  filePath: string
): BacklinkEntry[] {
  return index[filePath] || [];
}

/**
 * Resolve a link target to a full file path
 */
function resolveTargetPath(target: string, workspacePath: string): string {
  // Add .md extension if not present
  const withExt = target.endsWith(".md") ? target : `${target}.md`;

  // If already absolute, return as-is
  if (withExt.startsWith("/")) {
    return withExt;
  }

  // Make relative to workspace
  return `${workspacePath}/${withExt}`;
}

/**
 * Extract context around a link in the content
 * Returns a snippet of text surrounding the link
 */
function extractContext(content: string, linkRaw: string): string {
  const index = content.indexOf(linkRaw);
  if (index === -1) return "";

  const contextRadius = 50;
  const start = Math.max(0, index - contextRadius);
  const end = Math.min(content.length, index + linkRaw.length + contextRadius);

  let context = content.slice(start, end);

  // Clean up: trim to word boundaries and add ellipsis
  if (start > 0) {
    const firstSpace = context.indexOf(" ");
    if (firstSpace > 0 && firstSpace < 20) {
      context = "..." + context.slice(firstSpace + 1);
    } else {
      context = "..." + context;
    }
  }

  if (end < content.length) {
    const lastSpace = context.lastIndexOf(" ");
    if (lastSpace > context.length - 20) {
      context = context.slice(0, lastSpace) + "...";
    } else {
      context = context + "...";
    }
  }

  // Remove line breaks and excess whitespace
  context = context.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

  return context;
}

/**
 * Count total backlinks in the index
 */
export function countTotalBacklinks(index: BacklinksIndex): number {
  return Object.values(index).reduce((sum, links) => sum + links.length, 0);
}

/**
 * Get files with the most backlinks
 */
export function getMostLinkedFiles(
  index: BacklinksIndex,
  limit: number = 10
): { path: string; count: number }[] {
  return Object.entries(index)
    .map(([path, links]) => ({ path, count: links.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
