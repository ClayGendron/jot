/**
 * Link Updater
 *
 * Functions for updating internal links when files are renamed.
 * Used to maintain link integrity across the workspace.
 */

import { readFile, writeFile, renamePath } from "@/lib/tauri/files";
import { getRelativePathStrict } from "@/lib/path/pathUtils";

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
 *
 * @param markdown - The markdown content to update
 * @param oldRelativePath - Old relative path to match
 * @param newRelativePath - New relative path to replace with
 * @param caseSensitive - Whether to match paths case-sensitively (Linux: true, Windows/macOS: false)
 */
export function updateLinksInContent(
  markdown: string,
  oldRelativePath: string,
  newRelativePath: string,
  caseSensitive: boolean
): string {
  // Replace markdown links: [text](path.md) or [text](path.md#anchor)
  // The path could be with or without leading ./
  const patterns = [
    oldRelativePath, // "folder/file.md"
    "./" + oldRelativePath, // "./folder/file.md"
  ];

  // Use case-insensitive matching when filesystem is case-insensitive
  const flags = caseSensitive ? "g" : "gi";

  let result = markdown;
  for (const pattern of patterns) {
    // Match [any text](exact-path) or [any text](exact-path#anchor)
    // The negative lookbehind (?<!\!) ensures we don't match images ![...]
    const linkRegex = new RegExp(
      `(?<!\\!)\\[([^\\]]*)\\]\\(${escapeRegex(pattern)}(#[^)]*)?\\)`,
      flags
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
 * @param caseSensitiveFs - Whether filesystem is case-sensitive (Linux: true, Windows/macOS: false)
 * @returns Object with updated file paths and any errors encountered
 */
export async function renameFileWithLinkUpdates(
  oldPath: string,
  newPath: string,
  workspacePath: string,
  affectedFiles: { sourcePath: string }[],
  caseSensitiveFs: boolean
): Promise<{ updatedFiles: string[]; errors: string[] }> {
  const updatedFiles: string[] = [];
  const errors: string[] = [];

  // Calculate relative paths from workspace root
  const oldRelative = getRelativePathStrict(workspacePath, oldPath, caseSensitiveFs);
  const newRelative = getRelativePathStrict(workspacePath, newPath, caseSensitiveFs);

  // Update links in each affected file BEFORE renaming
  for (const file of affectedFiles) {
    try {
      const content = await readFile(file.sourcePath, workspacePath);
      const updated = updateLinksInContent(content, oldRelative, newRelative, caseSensitiveFs);

      if (updated !== content) {
        await writeFile(file.sourcePath, updated, workspacePath);
        updatedFiles.push(file.sourcePath);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`Failed to update ${file.sourcePath}: ${message}`);
    }
  }

  // Rename the actual file AFTER updating links
  await renamePath(oldPath, newPath, workspacePath);

  return { updatedFiles, errors };
}
