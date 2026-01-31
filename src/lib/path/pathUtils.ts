/**
 * Cross-Platform Path Utilities
 *
 * Provides unified path handling for Windows/macOS/Linux.
 * Uses @tauri-apps/api/path for filesystem operations and
 * normalize-path for display consistency.
 *
 * Key principle:
 * - Filesystem operations: Use Tauri path API (handles drive letters, UNC paths)
 * - Display/comparison: Use normalize-path for UI consistency (forward slashes)
 */

import {
  join,
  dirname,
  normalize,
} from "@tauri-apps/api/path";
import normalizePath from "normalize-path";

/**
 * Join path segments using the platform-appropriate separator.
 * Use for filesystem operations where the path will be passed to Tauri/Rust.
 */
export async function joinFsPaths(...segments: string[]): Promise<string> {
  return join(...segments);
}

/**
 * Get the parent directory of a path.
 * Use for filesystem operations.
 */
export async function getParentPath(path: string): Promise<string> {
  return dirname(path);
}

/**
 * Get the file name (last segment) of a path.
 * Works synchronously since it's just string manipulation.
 */
export function getFileName(path: string): string {
  // normalize-path is fine here since we're just splitting on /
  const normalized = normalizePath(path);
  return normalized.split("/").pop() || path;
}

/**
 * Get the file name without the extension.
 */
export function getFileNameWithoutExt(path: string): string {
  const name = getFileName(path);
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(0, dotIndex) : name;
}

/**
 * Normalize a path for display purposes.
 * Converts backslashes to forward slashes for consistent UI.
 * NOT for filesystem operations or equality checks on case-insensitive systems.
 */
export function normalizeForDisplay(path: string): string {
  return normalizePath(path);
}

/**
 * Get relative path from workspace to target.
 * Since Tauri lacks a native relative() function, we use string manipulation
 * when the target starts with the workspace path.
 *
 * @param workspacePath - The workspace root path
 * @param targetPath - The path to make relative
 * @returns Relative path if target is within workspace, otherwise full path
 */
export function getRelativePath(
  workspacePath: string,
  targetPath: string
): string {
  const normalizedWorkspace = normalizeForDisplay(workspacePath);
  const normalizedTarget = normalizeForDisplay(targetPath);
  const separator = "/"; // After normalizeForDisplay, always forward slash

  // Check if target is within workspace
  const workspacePrefix = normalizedWorkspace.endsWith(separator)
    ? normalizedWorkspace
    : normalizedWorkspace + separator;

  if (normalizedTarget.startsWith(workspacePrefix)) {
    return normalizedTarget.slice(workspacePrefix.length);
  }

  // Edge case: target is exactly the workspace
  if (normalizedTarget === normalizedWorkspace) {
    return "";
  }

  // Fallback: return full path (target not in workspace)
  return normalizedTarget;
}

/**
 * Build an absolute path from a relative path and workspace root.
 * Uses Tauri's join for platform-correct behavior.
 */
export async function buildAbsolutePath(
  workspacePath: string,
  relativePath: string
): Promise<string> {
  // If already absolute, return as-is (normalized)
  if (isAbsolutePath(relativePath)) {
    return normalize(relativePath);
  }
  return join(workspacePath, relativePath);
}

/**
 * Check if a path is absolute.
 * Handles Unix paths (/) and Windows paths (C:\, \\server\share).
 */
export function isAbsolutePath(path: string): boolean {
  // Unix absolute
  if (path.startsWith("/")) return true;
  // Windows drive letter (C:\, D:/, etc.)
  if (/^[A-Za-z]:[/\\]/.test(path)) return true;
  // Windows UNC path (\\server\share)
  if (path.startsWith("\\\\")) return true;
  return false;
}

/**
 * Normalize path for case-insensitive comparison.
 * ONLY use for display sorting, NOT for filesystem logic.
 *
 * Note: We default to case-insensitive since macOS and Windows are
 * case-insensitive. This is a safe default for most use cases.
 * For strict case-sensitive comparison, use the original path.
 *
 * @param path - Path to normalize
 * @returns Normalized path (lowercase, forward slashes)
 */
export function normalizeForComparisonSync(path: string): string {
  const normalized = normalizePath(path);
  // Default to case-insensitive (safe for Windows/macOS)
  return normalized.toLowerCase();
}

/**
 * Normalize a path for comparison with explicit case sensitivity control.
 * Use for path matching where case sensitivity depends on the OS.
 *
 * @param path - Path to normalize
 * @param caseSensitive - If true, preserve case; if false, lowercase
 * @returns Normalized path (forward slashes, optionally lowercased)
 */
export function normalizeForComparison(
  path: string,
  caseSensitive: boolean
): string {
  const normalized = normalizePath(path);
  return caseSensitive ? normalized : normalized.toLowerCase();
}

/**
 * Get relative path from workspace to target with explicit case sensitivity.
 * Handles case-insensitive matching for Windows/macOS while preserving
 * the original case in the returned path for display.
 *
 * @param workspacePath - The workspace root path
 * @param targetPath - The path to make relative
 * @param caseSensitive - If true, require exact case match; if false, match case-insensitively
 * @returns Relative path if target is within workspace, otherwise full path
 */
export function getRelativePathStrict(
  workspacePath: string,
  targetPath: string,
  caseSensitive: boolean
): string {
  // Normalize for display first (forward slashes)
  const normalizedWorkspace = normalizeForDisplay(workspacePath);
  const normalizedTarget = normalizeForDisplay(targetPath);

  // Use normalizeForComparison for consistent case handling
  const compareWorkspace = normalizeForComparison(normalizedWorkspace, caseSensitive);
  const compareTarget = normalizeForComparison(normalizedTarget, caseSensitive);

  const prefix = compareWorkspace.endsWith("/")
    ? compareWorkspace
    : compareWorkspace + "/";

  if (compareTarget.startsWith(prefix)) {
    // Return display-normalized path (preserves original case)
    return normalizedTarget.slice(prefix.length);
  }
  if (compareTarget === compareWorkspace) return "";
  return normalizedTarget;
}

/**
 * Get the parent directory path synchronously.
 * Works on normalized paths (forward slashes).
 *
 * @param path - Path to get parent of
 * @returns Parent directory path
 */
export function getParentPathSync(path: string): string {
  const normalized = normalizeForDisplay(path);
  if (/^[A-Za-z]:$/.test(normalized)) {
    return `${normalized}/`;
  }
  const parts = normalized.split("/");
  parts.pop();
  const parent = parts.join("/") || "/";
  if (/^[A-Za-z]:$/.test(parent)) {
    return `${parent}/`;
  }
  return parent;
}

/**
 * Check if a path is within another path (used for security validation).
 * Normalizes both paths for consistent comparison.
 *
 * @param path - Path to check
 * @param parentPath - Parent path to check against
 * @param caseSensitive - Whether to compare case-sensitively (Linux: true, Windows/macOS: false)
 */
export function isPathWithin(
  path: string,
  parentPath: string,
  caseSensitive: boolean
): boolean {
  const normalizedPath = normalizeForComparison(path, caseSensitive);
  const normalizedParent = normalizeForComparison(parentPath, caseSensitive);

  // Must start with parent path + separator
  return (
    normalizedPath === normalizedParent ||
    normalizedPath.startsWith(normalizedParent + "/")
  );
}

/**
 * Extract the file extension from a path.
 * Returns empty string if no extension.
 */
export function getExtension(path: string): string {
  const name = getFileName(path);
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.slice(dotIndex + 1) : "";
}

/**
 * Check if a path points to a markdown file.
 */
export function isMarkdownFile(path: string): boolean {
  return getExtension(path).toLowerCase() === "md";
}
