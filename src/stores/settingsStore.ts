import { create } from "zustand";
import type {
  GlobalAppSettings,
  RecentWorkspace,
  LayoutPreferences,
} from "@/lib/settings/types";
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_LAYOUT_PREFERENCES,
  MAX_RECENT_WORKSPACES,
} from "@/lib/settings/types";
import {
  readGlobalSettings,
  writeGlobalSettings,
  directoryExists,
} from "@/lib/tauri/settings";

/**
 * Settings state management
 *
 * Manages global application settings that persist across sessions.
 * This includes recent workspaces and default workspace configuration.
 */

export interface SettingsState {
  /** List of recently opened workspaces */
  recentWorkspaces: RecentWorkspace[];
  /** Default workspace to open on startup */
  defaultWorkspacePath: string | null;
  /** Layout preferences (sidebar width, visibility) */
  layout: LayoutPreferences;
  /** Whether settings have been loaded from disk */
  isLoaded: boolean;
  /** Loading state during async operations */
  isLoading: boolean;
  /** Error message if settings operation failed */
  error: string | null;
}

export interface SettingsActions {
  /** Load settings from disk */
  loadSettings: () => Promise<void>;
  /** Add or update a recent workspace */
  addRecentWorkspace: (path: string, name: string) => Promise<void>;
  /** Remove a workspace from the recent list */
  removeRecentWorkspace: (path: string) => Promise<void>;
  /** Clear all recent workspaces */
  clearRecentWorkspaces: () => Promise<void>;
  /** Set the default workspace path */
  setDefaultWorkspace: (path: string | null) => Promise<void>;
  /** Update layout preferences */
  updateLayout: (layout: Partial<LayoutPreferences>) => Promise<void>;
  /** Validate and clean up stale entries */
  cleanupStaleWorkspaces: () => Promise<void>;
}

const initialState: SettingsState = {
  recentWorkspaces: [],
  defaultWorkspacePath: null,
  layout: DEFAULT_LAYOUT_PREFERENCES,
  isLoaded: false,
  isLoading: false,
  error: null,
};

export const useSettingsStore = create<SettingsState & SettingsActions>(
  (set, get) => ({
    ...initialState,

    loadSettings: async () => {
      set({ isLoading: true, error: null });
      try {
        const settings = await readGlobalSettings();
        if (settings) {
          set({
            recentWorkspaces: settings.recentWorkspaces,
            defaultWorkspacePath: settings.defaultWorkspacePath,
            layout: settings.layout ?? DEFAULT_LAYOUT_PREFERENCES,
            isLoaded: true,
            isLoading: false,
          });
          // Clean up stale entries after loading (async, don't block startup)
          // This runs in the background to remove workspaces that no longer exist
          void get().cleanupStaleWorkspaces();
        } else {
          // No settings file yet, use defaults
          set({
            ...DEFAULT_GLOBAL_SETTINGS,
            isLoaded: true,
            isLoading: false,
          });
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
        set({
          error: err instanceof Error ? err.message : "Failed to load settings",
          isLoading: false,
          isLoaded: true,
        });
      }
    },

    addRecentWorkspace: async (path: string, name: string) => {
      const { recentWorkspaces } = get();

      // Remove existing entry for this path (will be re-added at front)
      const filtered = recentWorkspaces.filter((w) => w.path !== path);

      // Add to front of list
      const newEntry: RecentWorkspace = {
        path,
        name,
        lastOpened: Date.now(),
      };

      // Limit to max entries
      const updated = [newEntry, ...filtered].slice(0, MAX_RECENT_WORKSPACES);

      set({ recentWorkspaces: updated });

      // Persist to disk
      await persistSettings(get());
    },

    removeRecentWorkspace: async (path: string) => {
      const { recentWorkspaces, defaultWorkspacePath } = get();
      const updated = recentWorkspaces.filter((w) => w.path !== path);

      // Clear default if it was the removed workspace
      const newDefault = defaultWorkspacePath === path ? null : defaultWorkspacePath;

      set({
        recentWorkspaces: updated,
        defaultWorkspacePath: newDefault,
      });

      // Persist to disk
      await persistSettings(get());
    },

    clearRecentWorkspaces: async () => {
      set({
        recentWorkspaces: [],
        defaultWorkspacePath: null,
      });

      // Persist to disk
      await persistSettings(get());
    },

    setDefaultWorkspace: async (path: string | null) => {
      set({ defaultWorkspacePath: path });

      // Persist to disk
      await persistSettings(get());
    },

    updateLayout: async (layoutUpdate: Partial<LayoutPreferences>) => {
      const { layout } = get();
      const newLayout = { ...layout, ...layoutUpdate };
      set({ layout: newLayout });

      // Persist to disk
      await persistSettings(get());
    },

    cleanupStaleWorkspaces: async () => {
      const { recentWorkspaces, defaultWorkspacePath } = get();

      // Check each workspace directory
      const validWorkspaces: RecentWorkspace[] = [];
      for (const workspace of recentWorkspaces) {
        try {
          const exists = await directoryExists(workspace.path);
          if (exists) {
            validWorkspaces.push(workspace);
          }
        } catch {
          // Skip workspaces we can't verify
        }
      }

      // Check if default workspace still exists
      let validDefault = defaultWorkspacePath;
      if (validDefault) {
        try {
          const exists = await directoryExists(validDefault);
          if (!exists) {
            validDefault = null;
          }
        } catch {
          validDefault = null;
        }
      }

      // Only update if something changed
      if (
        validWorkspaces.length !== recentWorkspaces.length ||
        validDefault !== defaultWorkspacePath
      ) {
        set({
          recentWorkspaces: validWorkspaces,
          defaultWorkspacePath: validDefault,
        });

        // Persist to disk
        await persistSettings(get());
      }
    },
  })
);

/**
 * Persist current state to disk
 */
async function persistSettings(state: SettingsState): Promise<void> {
  try {
    const settings: GlobalAppSettings = {
      recentWorkspaces: state.recentWorkspaces,
      defaultWorkspacePath: state.defaultWorkspacePath,
      layout: state.layout,
      version: 1,
    };
    await writeGlobalSettings(settings);
  } catch (err) {
    console.error("Failed to persist settings:", err);
  }
}

/**
 * Selector for getting a workspace by path
 */
export function selectWorkspaceByPath(
  state: SettingsState,
  path: string
): RecentWorkspace | undefined {
  return state.recentWorkspaces.find((w) => w.path === path);
}
