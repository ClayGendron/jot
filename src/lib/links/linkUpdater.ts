/**
 * Link Updater
 *
 * Functions for updating internal links when files are renamed.
 * Used to maintain link integrity across the workspace.
 */

import { readFile, writeFile, renamePath } from "@/lib/tauri/files";

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Get relative path from workspace root
 */
function getRelativePath(absolutePath: string, workspacePath: string): string {
  if (absolutePath.startsWith(workspacePath + "/")) {
    return absolutePath.slice(workspacePath.length + 1);
  }
  return absolutePath;
}

/**
 * Updates all internal links in markdown content that point to oldTarget.
 *
 * Since links in markdown use workspace-relative paths (e.g., "folder/note.md"),
 * we match and replace those relative paths directly.
 *
 * Handles:
 * - [text](old-path.md) → [text](new-path.md)
 * - [text](old-path.md#heading) → [text](new-path.md#heading)
 * - [text](./old-path.md) → [text](new-path.md)
 */
export function updateLinksInContent(
  markdown: string,
  oldRelativePath: string,
  newRelativePath: string
): string {
  // Replace markdown links: [text](path.md) or [text](path.md#anchor)
  // The path could be with or without leading ./
  const patterns = [
    oldRelativePath, // "folder/file.md"
    "./" + oldRelativePath, // "./folder/file.md"
  ];

  let result = markdown;
  for (const pattern of patterns) {
    // Match [any text](exact-path) or [any text](exact-path#anchor)
    // The negative lookbehind (?<!\!) ensures we don't match images ![...]
    const linkRegex = new RegExp(
      `(?<!\\!)\\[([^\\]]*)\\]\\(${escapeRegex(pattern)}(#[^)]*)?\\)`,
      "g"
    );
    result = result.replace(linkRegex, `[$1](${newRelativePath}$2)`);
  }

  return result;
}

/**
 * Renames a file and updates all links pointing to it.
 *
 * @param oldPath - Absolute path of file to rename
 * @param newPath - New absolute path
 * @param workspacePath - Workspace root for relative path calculations
 * @param affectedFiles - Files that link to the renamed file (from backlinks)
 * @returns Object with updated file paths and any errors encountered
 */
export async function renameFileWithLinkUpdates(
  oldPath: string,
  newPath: string,
  workspacePath: string,
  affectedFiles: { sourcePath: string }[]
): Promise<{ updatedFiles: string[]; errors: string[] }> {
  const updatedFiles: string[] = [];
  const errors: string[] = [];

  // Calculate relative paths from workspace root
  const oldRelative = getRelativePath(oldPath, workspacePath);
  const newRelative = getRelativePath(newPath, workspacePath);

  // Update links in each affected file BEFORE renaming
  for (const file of affectedFiles) {
    try {
      const content = await readFile(file.sourcePath);
      const updated = updateLinksInContent(content, oldRelative, newRelative);

      if (updated !== content) {
        await writeFile(file.sourcePath, updated);
        updatedFiles.push(file.sourcePath);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`Failed to update ${file.sourcePath}: ${message}`);
    }
  }

  // Rename the actual file AFTER updating links
  await renamePath(oldPath, newPath);

  return { updatedFiles, errors };
}
