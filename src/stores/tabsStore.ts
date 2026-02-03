import { create } from "zustand";

/**
 * Tab state management using Zustand
 *
 * Handles multi-file editing with tabs. Each tab stores its own content,
 * dirty state, and scroll position for instant switching.
 */

export interface Tab {
  /** Unique identifier (UUID) */
  id: string;
  /** Full file path */
  filePath: string;
  /** Display name (file name without path) */
  displayName: string;
  /** Content - HTML when useMarkdownEditor=false (TipTap), Markdown when true (CodeMirror) */
  content: string;
  /** Whether tab has unsaved changes */
  isDirty: boolean;
  /** Whether tab is pinned (stays left, no close button) */
  isPinned: boolean;
  /** Scroll position to restore when switching back */
  scrollTop: number;
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface TabsState {
  /** Ordered list of tabs (pinned first, then unpinned) */
  tabs: Tab[];
  /** Currently active tab ID */
  activeTabId: string | null;
  /** Current save status for active tab */
  saveStatus: SaveStatus;
  /** Error message if save failed */
  saveError: string | null;
}

export interface TabsActions {
  /** Open a new tab or switch to existing if file already open */
  openTab: (filePath: string, content: string) => string;
  /** Close a tab by ID. Returns the ID of the tab to switch to, or null */
  closeTab: (tabId: string) => string | null;
  /** Close all tabs except the specified one */
  closeOtherTabs: (tabId: string) => void;
  /** Close all tabs (keeps pinned) */
  closeAllTabs: () => void;
  /** Clear ALL tabs including pinned (for workspace switch) */
  clearAllTabs: () => void;
  /** Set the active tab */
  setActiveTab: (tabId: string) => void;
  /** Update tab content (marks as dirty) */
  updateTabContent: (tabId: string, content: string) => void;
  /** Mark a tab as dirty */
  markTabDirty: (tabId: string) => void;
  /** Mark a tab as saved */
  markTabSaved: (tabId: string) => void;
  /** Reorder tabs (for drag-drop) */
  reorderTab: (fromIndex: number, toIndex: number) => void;
  /** Toggle pin state for a tab */
  togglePinTab: (tabId: string) => void;
  /** Update scroll position for a tab */
  updateTabScroll: (tabId: string, scrollTop: number) => void;
  /** Find a tab by file path */
  findTabByPath: (filePath: string) => Tab | undefined;
  /** Get the active tab */
  getActiveTab: () => Tab | undefined;
  /** Set save status */
  setSaveStatus: (status: SaveStatus, error?: string | null) => void;
  /** Rename tab when file is renamed */
  renameTab: (oldPath: string, newPath: string) => void;
}

function generateId(): string {
  return crypto.randomUUID();
}

import { getFileNameWithoutExt } from "@/lib/path/pathUtils";

function getDisplayName(filePath: string): string {
  // Use path utility for cross-platform file name extraction
  return getFileNameWithoutExt(filePath);
}

/**
 * Sort tabs with pinned first, maintaining relative order within each group
 */
function sortTabs(tabs: Tab[]): Tab[] {
  const pinned = tabs.filter((t) => t.isPinned);
  const unpinned = tabs.filter((t) => !t.isPinned);
  return [...pinned, ...unpinned];
}

const initialState: TabsState = {
  tabs: [],
  activeTabId: null,
  saveStatus: "idle",
  saveError: null,
};

export const useTabsStore = create<TabsState & TabsActions>((set, get) => ({
  ...initialState,

  openTab: (filePath, content) => {
    const state = get();

    // Check if tab already exists for this file
    const existingTab = state.tabs.find((t) => t.filePath === filePath);
    if (existingTab) {
      set({ activeTabId: existingTab.id });
      return existingTab.id;
    }

    // Create new tab
    const newTab: Tab = {
      id: generateId(),
      filePath,
      displayName: getDisplayName(filePath),
      content,
      isDirty: false,
      isPinned: false,
      scrollTop: 0,
    };

    set((state) => ({
      tabs: sortTabs([...state.tabs, newTab]),
      activeTabId: newTab.id,
      saveStatus: "idle",
      saveError: null,
    }));

    return newTab.id;
  },

  closeTab: (tabId) => {
    const state = get();
    const tabIndex = state.tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return null;

    const newTabs = state.tabs.filter((t) => t.id !== tabId);

    // Determine which tab to switch to
    let newActiveId: string | null = null;
    if (state.activeTabId === tabId && newTabs.length > 0) {
      // Switch to adjacent tab (prefer right, then left)
      const newIndex = Math.min(tabIndex, newTabs.length - 1);
      newActiveId = newTabs[newIndex].id;
    } else if (state.activeTabId !== tabId) {
      // Keep current active tab
      newActiveId = state.activeTabId;
    }

    set({
      tabs: newTabs,
      activeTabId: newActiveId,
    });

    return newActiveId;
  },

  closeOtherTabs: (tabId) => {
    const state = get();
    const tabToKeep = state.tabs.find((t) => t.id === tabId);
    if (!tabToKeep) return;

    // Keep pinned tabs and the specified tab
    const newTabs = state.tabs.filter((t) => t.id === tabId || t.isPinned);

    set({
      tabs: sortTabs(newTabs),
      activeTabId: tabId,
    });
  },

  closeAllTabs: () => {
    const state = get();
    // Keep only pinned tabs
    const pinnedTabs = state.tabs.filter((t) => t.isPinned);

    set({
      tabs: pinnedTabs,
      activeTabId: pinnedTabs.length > 0 ? pinnedTabs[0].id : null,
    });
  },

  /** Clear ALL tabs including pinned (for workspace switch) */
  clearAllTabs: () => {
    set({
      tabs: [],
      activeTabId: null,
    });
  },

  setActiveTab: (tabId) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === tabId);
    if (tab) {
      set({ activeTabId: tabId });
    }
  },

  updateTabContent: (tabId, content) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, content, isDirty: true } : t
      ),
    }));
  },

  markTabDirty: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, isDirty: true } : t
      ),
    }));
  },

  markTabSaved: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, isDirty: false } : t
      ),
    }));
  },

  reorderTab: (fromIndex, toIndex) => {
    set((state) => {
      const newTabs = [...state.tabs];
      const [movedTab] = newTabs.splice(fromIndex, 1);

      // Ensure pinned tabs stay in pinned section
      const pinnedCount = newTabs.filter((t) => t.isPinned).length;
      let targetIndex = toIndex;

      if (movedTab.isPinned) {
        // Pinned tab can only move within pinned section
        targetIndex = Math.min(toIndex, pinnedCount);
      } else {
        // Unpinned tab can only move within unpinned section
        targetIndex = Math.max(toIndex, pinnedCount);
      }

      newTabs.splice(targetIndex, 0, movedTab);
      return { tabs: newTabs };
    });
  },

  togglePinTab: (tabId) => {
    set((state) => {
      const newTabs = state.tabs.map((t) =>
        t.id === tabId ? { ...t, isPinned: !t.isPinned } : t
      );
      return { tabs: sortTabs(newTabs) };
    });
  },

  updateTabScroll: (tabId, scrollTop) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, scrollTop } : t
      ),
    }));
  },

  findTabByPath: (filePath) => {
    return get().tabs.find((t) => t.filePath === filePath);
  },

  getActiveTab: () => {
    const state = get();
    return state.tabs.find((t) => t.id === state.activeTabId);
  },

  setSaveStatus: (status, error = null) => {
    set({ saveStatus: status, saveError: error });
  },

  renameTab: (oldPath, newPath) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.filePath === oldPath
          ? { ...t, filePath: newPath, displayName: getDisplayName(newPath) }
          : t
      ),
    }));
  },
}));

/**
 * Selector for active tab (use with useMemo to avoid React 19 issues)
 */
export const selectActiveTab = (state: TabsState & TabsActions): Tab | undefined => {
  return state.tabs.find((t) => t.id === state.activeTabId);
};

/**
 * Check if any tab has unsaved changes
 */
export const selectHasUnsavedChanges = (state: TabsState & TabsActions): boolean => {
  return state.tabs.some((t) => t.isDirty);
};
