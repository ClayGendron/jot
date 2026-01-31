/**
 * Backlinks index and query functionality
 *
 * Pure functions for building and querying a backlinks index.
 * The index maps file paths to the files that link to them.
 */

import { extractInternalLinks } from "@/lib/markdown/parser";
import normalizePath from "normalize-path";
import { normalizeForComparison } from "@/lib/path/pathUtils";

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
 *
 * @param files - Array of file contents to index
 * @param workspacePath - Workspace root path
 * @param caseSensitive - Whether filesystem is case-sensitive (Linux: true, Windows/macOS: false)
 */
export function buildBacklinksIndex(
  files: FileContent[],
  workspacePath: string,
  caseSensitive: boolean
): BacklinksIndex {
  const index: BacklinksIndex = {};

  for (const file of files) {
    const links = extractInternalLinks(file.content);

    for (const link of links) {
      // Resolve the target path using source file context (handles ../)
      const targetPath = resolveTargetPathFromSource(
        link.target,
        file.path,
        workspacePath
      );

      // Skip if resolution failed (path escapes workspace)
      if (targetPath === null) {
        continue;
      }

      // Use normalized key for index to handle case-insensitive filesystems
      const indexKey = normalizeForComparison(targetPath, caseSensitive);

      if (!index[indexKey]) {
        index[indexKey] = [];
      }

      index[indexKey].push({
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
 *
 * @param index - The backlinks index
 * @param filePath - Path of the file to get backlinks for
 * @param caseSensitive - Whether filesystem is case-sensitive (Linux: true, Windows/macOS: false)
 */
export function getBacklinksForFile(
  index: BacklinksIndex,
  filePath: string,
  caseSensitive: boolean
): BacklinkEntry[] {
  const key = normalizeForComparison(filePath, caseSensitive);
  return index[key] || [];
}

/**
 * Resolve a link target to a full file path, handling ../ relative paths
 * @param target - The link target (e.g., "../sibling.md", "subfolder/file")
 * @param sourceFilePath - Absolute path of the file containing the link
 * @param workspacePath - Workspace root path
 * @returns Resolved absolute path, or null if escapes workspace
 */
export function resolveTargetPathFromSource(
  target: string,
  sourceFilePath: string,
  workspacePath: string
): string | null {
  // Normalize path separators (handle Windows backslashes → forward slashes)
  const normalized = normalizePath(target).replace(/^\.\//, "");

  // Add .md extension if not present
  const withExt = normalized.endsWith(".md") ? normalized : `${normalized}.md`;

  // Normalize workspace path for comparison
  const normalizedWorkspace = normalizePath(workspacePath);

  // If already absolute (starts with / or Windows drive letter), just validate within workspace
  if (withExt.startsWith("/") || /^[A-Za-z]:/.test(withExt)) {
    const normalizedTarget = normalizePath(withExt);
    if (!normalizedTarget.startsWith(normalizedWorkspace)) {
      return null;
    }
    return normalizedTarget;
  }

  // Get source file's directory
  const normalizedSourcePath = normalizePath(sourceFilePath);
  const sourceDir = normalizedSourcePath.split("/").slice(0, -1).join("/");

  // Resolve relative path from source directory
  const fullPath = `${sourceDir}/${withExt}`;
  const segments = fullPath.split("/");
  const resolved: string[] = [];

  // Track if path starts with / (Unix absolute path)
  const isUnixAbsolute = fullPath.startsWith("/");

  for (const segment of segments) {
    if (segment === "..") {
      if (resolved.length > 0) {
        resolved.pop();
      }
    } else if (segment !== "." && segment !== "") {
      resolved.push(segment);
    }
  }

  // Reconstruct path, preserving Unix absolute path prefix
  const resolvedPath = isUnixAbsolute
    ? "/" + resolved.join("/")
    : resolved.join("/");

  // Guard: Ensure path stays within workspace
  if (!resolvedPath.startsWith(normalizedWorkspace)) {
    // Path escapes workspace - return null to indicate invalid
    return null;
  }

  return resolvedPath;
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
