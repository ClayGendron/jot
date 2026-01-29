import { create } from "zustand";
import type { FileEntry } from "@/lib/tauri/files";

/**
 * Workspace state management
 *
 * Manages the current workspace (folder) and file tree state.
 */

export interface WorkspaceState {
  /** Current workspace root path */
  workspacePath: string | null;
  /** File tree entries */
  fileTree: FileEntry[];
  /** Currently selected file path */
  selectedPath: string | null;
  /** Expanded folder paths */
  expandedPaths: Set<string>;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Sort order */
  sortBy: "name" | "modified";
  /** Sort direction */
  sortDirection: "asc" | "desc";
}

export interface WorkspaceActions {
  // Workspace
  setWorkspacePath: (path: string | null) => void;
  setFileTree: (entries: FileEntry[]) => void;
  loadWorkspace: (path: string, entries: FileEntry[]) => void;

  // Selection
  setSelectedPath: (path: string | null) => void;

  // Expansion
  toggleExpanded: (path: string) => void;
  setExpanded: (path: string, expanded: boolean) => void;
  expandAll: () => void;
  collapseAll: () => void;

  // Loading/Error
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Sorting
  setSortBy: (sortBy: "name" | "modified") => void;
  setSortDirection: (direction: "asc" | "desc") => void;

  // File operations
  addEntry: (parentPath: string, entry: FileEntry) => void;
  removeEntry: (path: string) => void;
  updateEntry: (path: string, updates: Partial<FileEntry>) => void;

  // Reset
  reset: () => void;
}

const initialState: WorkspaceState = {
  workspacePath: null,
  fileTree: [],
  selectedPath: null,
  expandedPaths: new Set(),
  isLoading: false,
  error: null,
  sortBy: "name",
  sortDirection: "asc",
};

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>(
  (set, get) => ({
    ...initialState,

    setWorkspacePath: (path) =>
      set({
        workspacePath: path,
        fileTree: [],
        selectedPath: null,
        expandedPaths: new Set(),
        error: null,
      }),

    setFileTree: (entries) => set({ fileTree: entries }),

    loadWorkspace: (path, entries) =>
      set({
        workspacePath: path,
        fileTree: entries,
        selectedPath: null,
        expandedPaths: new Set(),
        error: null,
        isLoading: false,
      }),

    setSelectedPath: (path) => set({ selectedPath: path }),

    toggleExpanded: (path) => {
      const { expandedPaths } = get();
      const newExpanded = new Set(expandedPaths);

      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }

      set({ expandedPaths: newExpanded });
    },

    setExpanded: (path, expanded) => {
      const { expandedPaths } = get();
      const newExpanded = new Set(expandedPaths);

      if (expanded) {
        newExpanded.add(path);
      } else {
        newExpanded.delete(path);
      }

      set({ expandedPaths: newExpanded });
    },

    expandAll: () => {
      const { fileTree } = get();
      const allPaths = new Set<string>();

      const collectPaths = (entries: FileEntry[]) => {
        for (const entry of entries) {
          if (entry.is_dir) {
            allPaths.add(entry.path);
            if (entry.children) {
              collectPaths(entry.children);
            }
          }
        }
      };

      collectPaths(fileTree);
      set({ expandedPaths: allPaths });
    },

    collapseAll: () => set({ expandedPaths: new Set() }),

    setLoading: (isLoading) => set({ isLoading }),

    setError: (error) => set({ error }),

    setSortBy: (sortBy) => set({ sortBy }),

    setSortDirection: (sortDirection) => set({ sortDirection }),

    addEntry: (parentPath, entry) => {
      const { fileTree, workspacePath } = get();

      const addToTree = (
        entries: FileEntry[],
        targetPath: string
      ): FileEntry[] => {
        return entries.map((e) => {
          if (e.path === targetPath && e.children) {
            return {
              ...e,
              children: [...e.children, entry].sort((a, b) => {
                // Sort folders first, then alphabetically
                if (a.is_dir && !b.is_dir) return -1;
                if (!a.is_dir && b.is_dir) return 1;
                return a.name.localeCompare(b.name);
              }),
            };
          }
          if (e.children) {
            return { ...e, children: addToTree(e.children, targetPath) };
          }
          return e;
        });
      };

      // If adding to root
      if (parentPath === workspacePath) {
        const newTree = [...fileTree, entry].sort((a, b) => {
          if (a.is_dir && !b.is_dir) return -1;
          if (!a.is_dir && b.is_dir) return 1;
          return a.name.localeCompare(b.name);
        });
        set({ fileTree: newTree });
      } else {
        set({ fileTree: addToTree(fileTree, parentPath) });
      }
    },

    removeEntry: (path) => {
      const { fileTree } = get();

      const removeFromTree = (entries: FileEntry[]): FileEntry[] => {
        return entries
          .filter((e) => e.path !== path)
          .map((e) => {
            if (e.children) {
              return { ...e, children: removeFromTree(e.children) };
            }
            return e;
          });
      };

      set({ fileTree: removeFromTree(fileTree) });
    },

    updateEntry: (path, updates) => {
      const { fileTree } = get();

      const updateInTree = (entries: FileEntry[]): FileEntry[] => {
        return entries.map((e) => {
          if (e.path === path) {
            return { ...e, ...updates };
          }
          if (e.children) {
            return { ...e, children: updateInTree(e.children) };
          }
          return e;
        });
      };

      set({ fileTree: updateInTree(fileTree) });
    },

    reset: () => set(initialState),
  })
);

/**
 * Selector for getting a flat list of all file paths
 */
export function selectAllFilePaths(state: WorkspaceState): string[] {
  const paths: string[] = [];

  const collectPaths = (entries: FileEntry[]) => {
    for (const entry of entries) {
      if (entry.is_markdown) {
        paths.push(entry.path);
      }
      if (entry.children) {
        collectPaths(entry.children);
      }
    }
  };

  collectPaths(state.fileTree);
  return paths;
}

/**
 * File info for internal link suggestions
 */
export interface SuggestionFile {
  name: string;
  path: string;
  displayPath: string; // Relative path from workspace for display
}

/**
 * Selector for getting all markdown files as suggestion items
 */
export function selectAllFilesForSuggestion(state: WorkspaceState): SuggestionFile[] {
  const files: SuggestionFile[] = [];
  const workspacePath = state.workspacePath;

  const collectFiles = (entries: FileEntry[]) => {
    for (const entry of entries) {
      if (entry.is_markdown) {
        // Get relative path from workspace root
        const displayPath = workspacePath
          ? entry.path.replace(workspacePath + "/", "")
          : entry.name;

        files.push({
          name: entry.name,
          path: entry.path,
          displayPath,
        });
      }
      if (entry.children) {
        collectFiles(entry.children);
      }
    }
  };

  collectFiles(state.fileTree);
  return files;
}
