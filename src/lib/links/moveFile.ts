/**
 * Move File Utilities
 *
 * Functions for moving files/folders within the workspace
 * and updating internal links accordingly.
 */

import { readFile, writeFile, renamePath, getFileName } from "@/lib/tauri/files";
import { buildDisplayPath } from "./linkService";
import { updateLinksInContent } from "./linkUpdater";
import { getParentPathSync, normalizeForComparison } from "@/lib/path/pathUtils";
import normalizePathLib from "normalize-path";
import isPathInside from "is-path-inside";

/**
 * Result of move validation
 */
export interface MoveValidation {
  valid: boolean;
  error?: string;
}

/**
 * Check if an absolute path is within the workspace
 * Unlike linkService.isWithinWorkspace, this doesn't normalize/resolve the path first -
 * it checks if the literal path is inside the workspace.
 */
function isAbsolutePathWithinWorkspace(
  absolutePath: string,
  workspacePath: string
): boolean {
  const normalizedPath = normalizePathLib(absolutePath);
  const normalizedWorkspace = normalizePathLib(workspacePath);

  return (
    normalizedPath === normalizedWorkspace ||
    isPathInside(normalizedPath, normalizedWorkspace)
  );
}

/**
 * Validate that a move operation is allowed
 *
 * Checks:
 * - Source is within workspace
 * - Target is within workspace
 * - Not moving folder into itself or descendant
 * - Not moving to same location
 *
 * @param sourcePath - Absolute path of file/folder to move
 * @param targetFolderPath - Absolute path of destination folder
 * @param workspacePath - Workspace root path
 * @param caseSensitiveFs - Whether filesystem is case-sensitive (Linux: true, Windows/macOS: false)
 */
export function validateMove(
  sourcePath: string,
  targetFolderPath: string,
  workspacePath: string,
  caseSensitiveFs: boolean
): MoveValidation {
  // Check source is within workspace (must be an absolute path inside workspace)
  if (!isAbsolutePathWithinWorkspace(sourcePath, workspacePath)) {
    return { valid: false, error: "Source is outside workspace" };
  }

  // Check target is within workspace
  if (!isAbsolutePathWithinWorkspace(targetFolderPath, workspacePath)) {
    return { valid: false, error: "Target is outside workspace" };
  }

  // Check not moving folder into itself or descendant
  // Use normalizeForComparison for case-aware path matching
  const normalizedSource = normalizeForComparison(
    normalizePathLib(sourcePath).replace(/\/+$/, ""),
    caseSensitiveFs
  );
  const normalizedTarget = normalizeForComparison(
    normalizePathLib(targetFolderPath).replace(/\/+$/, ""),
    caseSensitiveFs
  );

  if (
    normalizedTarget === normalizedSource ||
    normalizedTarget.startsWith(normalizedSource + "/")
  ) {
    return { valid: false, error: "Cannot move folder into itself" };
  }

  // Check not moving to same location (parent folder is same as target)
  const sourceParent = normalizeForComparison(
    getParentPathSync(sourcePath),
    caseSensitiveFs
  );
  if (normalizedTarget === sourceParent) {
    return { valid: false, error: "File is already in same location" };
  }

  return { valid: true };
}

/**
 * Calculate the new path for a file/folder being moved
 */
export function calculateNewPath(
  sourcePath: string,
  targetFolderPath: string
): string {
  const fileName = getFileName(sourcePath);
  // Normalize for cross-platform consistency (Windows backslashes → forward slashes)
  const normalizedTarget = normalizePathLib(targetFolderPath).replace(/\/+$/, "");
  return `${normalizedTarget}/${fileName}`;
}

/**
 * Update links in content for a file move
 *
 * This is essentially the same as rename - we're updating
 * the relative paths in links to reflect the new location.
 * Delegates to updateLinksInContent for the actual regex work.
 *
 * @param markdown - The markdown content to update
 * @param oldRelativePath - Old relative path of the moved file
 * @param newRelativePath - New relative path of the moved file
 * @param caseSensitive - Whether to use case-sensitive matching
 */
export function updateLinksForMove(
  markdown: string,
  oldRelativePath: string,
  newRelativePath: string,
  caseSensitive: boolean
): string {
  return updateLinksInContent(markdown, oldRelativePath, newRelativePath, caseSensitive);
}

/**
 * Move a file/folder and update all links pointing to it
 *
 * @param sourcePath - Absolute path of file/folder to move
 * @param targetFolderPath - Absolute path of destination folder
 * @param workspacePath - Workspace root for relative path calculations
 * @param affectedFiles - Files that link to the moved file (from backlinks)
 * @param caseSensitiveFs - Whether filesystem is case-sensitive (Linux: true, Windows/macOS: false)
 * @returns Object with new path, updated files, and any errors
 */
export async function moveFileWithLinkUpdates(
  sourcePath: string,
  targetFolderPath: string,
  workspacePath: string,
  affectedFiles: { sourcePath: string }[],
  caseSensitiveFs: boolean
): Promise<{
  newPath: string;
  updatedFiles: string[];
  errors: string[];
}> {
  const updatedFiles: string[] = [];
  const errors: string[] = [];

  // Calculate paths
  const newPath = calculateNewPath(sourcePath, targetFolderPath);
  const oldRelative = buildDisplayPath(sourcePath, workspacePath);
  const newRelative = buildDisplayPath(newPath, workspacePath);

  // Update links in each affected file BEFORE moving
  for (const file of affectedFiles) {
    try {
      const content = await readFile(file.sourcePath, workspacePath);
      const updated = updateLinksForMove(content, oldRelative, newRelative, caseSensitiveFs);

      if (updated !== content) {
        await writeFile(file.sourcePath, updated, workspacePath);
        updatedFiles.push(file.sourcePath);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push(`Failed to update ${file.sourcePath}: ${message}`);
    }
  }

  // Move the actual file/folder AFTER updating links
  // renamePath handles moves (it's just a rename with different parent)
  await renamePath(sourcePath, newPath, workspacePath);

  return { newPath, updatedFiles, errors };
}
