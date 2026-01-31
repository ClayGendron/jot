/**
 * Internal link resolver
 *
 * Pure functions for resolving wiki-style internal links to file paths.
 * Handles filename matching, path resolution, and ambiguity detection.
 */

import { getRelativePath, isAbsolutePath } from "@/lib/path/pathUtils";

export interface ParsedLink {
  fileName: string;
  filePath: string;
  heading?: string;
}

export interface ResolvedLink {
  exists: boolean;
  resolvedPath: string | null;
  heading?: string;
  ambiguous?: boolean;
  alternatives?: string[];
}

export interface FileInfo {
  name: string;
  path: string;
}

/**
 * Check if a URL is a same-file heading link (starts with #)
 */
export function isSameFileHeadingLink(href: string): boolean {
  return href.startsWith("#") && href.length > 1;
}

/**
 * Check if a URL is an internal markdown link
 */
export function isInternalLink(href: string): boolean {
  // Skip external URLs
  if (
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#") // Same-page anchor only
  ) {
    return false;
  }

  // Check if it's a .md file (with or without anchor) - case-insensitive
  const pathWithoutAnchor = href.split("#")[0];

  // Reject absolute paths (Windows drive letters like C:\, UNC paths like \\server)
  // These should not be treated as internal links to avoid creating bogus paths
  if (isAbsolutePath(pathWithoutAnchor)) {
    return false;
  }

  return pathWithoutAnchor.toLowerCase().endsWith(".md");
}

/**
 * Parse an internal link href into components
 */
export function parseInternalLink(href: string): ParsedLink {
  // Split off the heading anchor if present
  const [pathPart, heading] = href.split("#");

  // Extract filename from path
  const pathSegments = pathPart.split("/");
  const fileNameWithExt = pathSegments[pathSegments.length - 1];
  const fileName = fileNameWithExt.replace(/\.md$/i, "");

  return {
    fileName,
    filePath: pathPart,
    heading: heading || undefined,
  };
}

/**
 * Resolve an internal link to a full file path
 *
 * @param href - The link href to resolve
 * @param workspacePath - The workspace root path
 * @param files - List of files to search
 * @param caseSensitive - Whether to use case-sensitive matching (Linux: true, Windows/macOS: false)
 */
export function resolveInternalLink(
  href: string,
  workspacePath: string,
  files: FileInfo[],
  caseSensitive = false
): ResolvedLink {
  const parsed = parseInternalLink(href);
  const { filePath, heading } = parsed;

  // Normalize the search path (remove leading ./)
  const normalizedSearch = filePath.replace(/^\.\//, "");

  // Check if search includes a directory path
  const hasDirectoryPath = normalizedSearch.includes("/");

  // Helper for path comparison based on case sensitivity
  const pathsMatch = (a: string, b: string) =>
    caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase();

  // If search has a directory path, try path match first
  if (hasDirectoryPath) {
    const pathMatch = files.find((f) => {
      const relativePath = getRelativePath(workspacePath, f.path);
      return pathsMatch(relativePath, normalizedSearch);
    });

    if (pathMatch) {
      return {
        exists: true,
        resolvedPath: pathMatch.path,
        heading,
      };
    }
  }

  // Search by filename only (or when directory path didn't match)
  const fileNameOnly = normalizedSearch.split("/").pop() || normalizedSearch;
  const fileNameMatches = files.filter((f) =>
    pathsMatch(f.name, fileNameOnly)
  );

  if (fileNameMatches.length === 0) {
    return {
      exists: false,
      resolvedPath: null,
      heading,
    };
  }

  if (fileNameMatches.length === 1) {
    return {
      exists: true,
      resolvedPath: fileNameMatches[0].path,
      heading,
    };
  }

  // Multiple matches - return first but mark as ambiguous
  return {
    exists: true,
    resolvedPath: fileNameMatches[0].path,
    heading,
    ambiguous: true,
    alternatives: fileNameMatches.slice(1).map((f) => f.path),
  };
}

/**
 * Get display text for an internal link
 * Converts "folder/note.md" to "note" for cleaner display
 */
export function getInternalLinkDisplayText(href: string): string {
  const parsed = parseInternalLink(href);
  if (parsed.heading) {
    return `${parsed.fileName}#${parsed.heading}`;
  }
  return parsed.fileName;
}

/**
 * Convert a file path to a relative link href
 */
export function filePathToHref(
  filePath: string,
  workspacePath: string
): string {
  return getRelativePath(workspacePath, filePath);
}
