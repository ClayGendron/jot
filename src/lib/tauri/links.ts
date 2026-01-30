/**
 * Link-related Tauri commands
 *
 * TypeScript bindings for Rust functions that handle path validation
 * and link indexing operations.
 */

import { invoke } from "@tauri-apps/api/core";

/**
 * Normalize a path and resolve .. and . components
 * Returns the normalized path or throws if it would escape the workspace
 */
export async function normalizePath(
  path: string,
  workspacePath: string
): Promise<string> {
  return invoke<string>("jot_normalize_path", { path, workspacePath });
}

/**
 * Check if a path is within the workspace
 */
export async function isWithinWorkspace(
  path: string,
  workspacePath: string
): Promise<boolean> {
  return invoke<boolean>("jot_is_within_workspace", { path, workspacePath });
}

/**
 * Validate a path and return the normalized version if valid
 * Throws an error if the path would escape the workspace
 */
export async function validatePath(
  path: string,
  workspacePath: string
): Promise<string> {
  const isValid = await isWithinWorkspace(path, workspacePath);
  if (!isValid) {
    throw new Error(`Path "${path}" is outside workspace`);
  }
  return normalizePath(path, workspacePath);
}

/**
 * Create a file with workspace path validation (safe version)
 * Uses Rust's path validation to ensure file is created within workspace
 */
export async function createFileSafe(
  path: string,
  workspacePath: string
): Promise<void> {
  // jot_create_file now validates workspace path internally
  return invoke("jot_create_file", { path, workspacePath });
}
