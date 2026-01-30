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
 * Layout preferences for panels
 */
export interface LayoutPreferences {
  /** Sidebar width in pixels */
  sidebarWidth: number;
  /** Whether sidebar is visible */
  sidebarOpen: boolean;
}

/**
 * Appearance preferences for theme and typography
 */
export interface AppearancePreferences {
  /** Color theme: light, dark, or follow system */
  theme: "light" | "dark" | "system";
  /** Editor font family */
  fontFamily: "serif" | "sans" | "mono";
}

/**
 * Persisted tab state for session restore
 */
export interface PersistedTab {
  /** Full file path */
  filePath: string;
  /** Whether tab is pinned */
  isPinned: boolean;
}

/**
 * State for restoring open tabs
 */
export interface PersistedTabState {
  /** Ordered list of tabs */
  tabs: PersistedTab[];
  /** Active tab's file path (null if no active tab) */
  activeTabPath: string | null;
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
  /** Layout preferences (panel sizes, visibility) */
  layout?: LayoutPreferences;
  /** Appearance preferences (theme, font) */
  appearance?: AppearancePreferences;
  /** Open tabs state for session restore */
  openTabs?: PersistedTabState;
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
 * Default layout preferences
 */
export const DEFAULT_LAYOUT_PREFERENCES: LayoutPreferences = {
  sidebarWidth: 260,
  sidebarOpen: true,
};

/**
 * Default appearance preferences
 */
export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  theme: "system",
  fontFamily: "serif",
};

/**
 * Default global settings
 */
export const DEFAULT_GLOBAL_SETTINGS: GlobalAppSettings = {
  recentWorkspaces: [],
  defaultWorkspacePath: null,
  layout: DEFAULT_LAYOUT_PREFERENCES,
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
