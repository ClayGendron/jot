/**
 * Settings type definitions
 *
 * Defines types for global application settings and per-workspace settings.
 */

/**
 * A recent workspace entry
 */
export interface RecentWorkspace {
  /** Full path to the workspace directory */
  path: string;
  /** Display name (folder name) */
  name: string;
  /** Last opened timestamp (Unix ms) */
  lastOpened: number;
}

/**
 * Global application settings
 *
 * Stored in the app data directory (platform-specific).
 * These settings persist across all workspaces.
 */
export interface GlobalAppSettings {
  /** List of recently opened workspaces (max 10, most recent first) */
  recentWorkspaces: RecentWorkspace[];
  /** Default workspace to open on startup (null = show welcome) */
  defaultWorkspacePath: string | null;
  /** Schema version for migrations */
  version: number;
}

/**
 * Per-workspace settings
 *
 * Stored in .jot/config.json within each workspace.
 * These settings are specific to one workspace.
 */
export interface WorkspaceSettings {
  /** Schema version for migrations */
  version: number;
  // Future: theme override, editor preferences, etc.
}

/**
 * Default global settings
 */
export const DEFAULT_GLOBAL_SETTINGS: GlobalAppSettings = {
  recentWorkspaces: [],
  defaultWorkspacePath: null,
  version: 1,
};

/**
 * Default workspace settings
 */
export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  version: 1,
};

/**
 * Maximum number of recent workspaces to keep
 */
export const MAX_RECENT_WORKSPACES = 10;
