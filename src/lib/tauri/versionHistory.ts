/**
 * Version History Service
 *
 * TypeScript bindings for the Rust version history backend.
 * Manages document snapshots stored in .jot/history.db
 */

import { invoke } from "@tauri-apps/api/core";

/** Lightweight version metadata (without content) */
export interface VersionMeta {
  id: number;
  file_path: string;
  created_at: number; // Unix timestamp in milliseconds
  byte_size: number;
  word_count: number;
  preview: string; // First ~100 chars of content
}

/** Full version with content */
export interface Version extends VersionMeta {
  content: string;
}

/** Diff line for side-by-side comparison */
export interface DiffLine {
  line_num_old: number | null;
  line_num_new: number | null;
  content: string;
  change_type: "equal" | "insert" | "delete";
}

/** Diff result between two versions */
export interface VersionDiff {
  old_version_id: number;
  new_version_id: number;
  lines: DiffLine[];
  additions: number;
  deletions: number;
}

/**
 * Save a new version snapshot
 * @returns Version ID, or -1 if content unchanged from latest
 */
export async function saveVersion(
  workspacePath: string,
  filePath: string,
  content: string
): Promise<number> {
  return invoke("jot_save_version", {
    workspacePath,
    filePath,
    content,
  });
}

/**
 * Get version metadata list for a file (most recent first)
 */
export async function getVersions(
  workspacePath: string,
  filePath: string,
  limit = 50
): Promise<VersionMeta[]> {
  return invoke("jot_get_versions", {
    workspacePath,
    filePath,
    limit,
  });
}

/**
 * Get a specific version by ID
 */
export async function getVersion(
  workspacePath: string,
  versionId: number
): Promise<Version | null> {
  return invoke("jot_get_version", {
    workspacePath,
    versionId,
  });
}

/**
 * Delete a specific version
 */
export async function deleteVersion(
  workspacePath: string,
  versionId: number
): Promise<boolean> {
  return invoke("jot_delete_version", {
    workspacePath,
    versionId,
  });
}

/**
 * Delete all versions for a file
 */
export async function deleteFileVersions(
  workspacePath: string,
  filePath: string
): Promise<number> {
  return invoke("jot_delete_file_versions", {
    workspacePath,
    filePath,
  });
}

/**
 * Compare two versions and return a diff
 */
export async function diffVersions(
  workspacePath: string,
  oldVersionId: number,
  newVersionId: number
): Promise<VersionDiff | null> {
  return invoke("jot_diff_versions", {
    workspacePath,
    oldVersionId,
    newVersionId,
  });
}

/**
 * Get total version count for a file
 */
export async function getVersionCount(
  workspacePath: string,
  filePath: string
): Promise<number> {
  return invoke("jot_get_version_count", {
    workspacePath,
    filePath,
  });
}

/**
 * Clean up old versions based on retention policy
 */
export async function cleanupOldVersions(
  workspacePath: string
): Promise<number> {
  return invoke("jot_cleanup_old_versions", {
    workspacePath,
  });
}

/**
 * Get the retention setting in days
 */
export async function getRetentionDays(
  workspacePath: string
): Promise<number> {
  return invoke("jot_get_retention_days", {
    workspacePath,
  });
}

/**
 * Set the retention setting in days
 */
export async function setRetentionDays(
  workspacePath: string,
  days: number
): Promise<void> {
  return invoke("jot_set_retention_days", {
    workspacePath,
    days,
  });
}

/**
 * Update file path for all versions when a file is renamed
 */
export async function updateVersionFilePath(
  workspacePath: string,
  oldPath: string,
  newPath: string
): Promise<number> {
  return invoke("jot_update_version_file_path", {
    workspacePath,
    oldPath,
    newPath,
  });
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * Format a timestamp for display
 */
export function formatVersionDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // Relative time for recent versions
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  // Absolute date for older versions
  const sameYear = date.getFullYear() === now.getFullYear();
  if (sameYear) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format byte size for display
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format word count for display
 */
export function formatWordCount(count: number): string {
  if (count === 1) return "1 word";
  return `${count.toLocaleString()} words`;
}
