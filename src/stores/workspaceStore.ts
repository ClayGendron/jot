import { create } from "zustand";
import type { FileEntry } from "@/lib/tauri/files";
import { sortFileEntries } from "@/lib/files/sortFiles";


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
  /** Paths of folders currently being lazy loaded */
  loadingPaths: Set<string>;
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

  // Lazy loading
  loadFolderChildren: (folderPath: string, children: FileEntry[]) => void;
  setPathLoading: (path: string, loading: boolean) => void;

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
  loadingPaths: new Set(),
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

    loadFolderChildren: (folderPath, children) => {
      const { fileTree, loadingPaths, sortBy, sortDirection } = get();

      // Apply current sort to children
      const sortedChildren = sortFileEntries(children, sortBy, sortDirection);

      const updateTree = (entries: FileEntry[]): FileEntry[] => {
        return entries.map((e) => {
          if (e.path === folderPath && e.is_dir) {
            return { ...e, children: sortedChildren };
          }
          if (e.children) {
            return { ...e, children: updateTree(e.children) };
          }
          return e;
        });
      };

      const newLoadingPaths = new Set(loadingPaths);
      newLoadingPaths.delete(folderPath);

      set({
        fileTree: updateTree(fileTree),
        loadingPaths: newLoadingPaths,
      });
    },

    setPathLoading: (path, loading) => {
      const { loadingPaths } = get();
      const newLoadingPaths = new Set(loadingPaths);
      if (loading) {
        newLoadingPaths.add(path);
      } else {
        newLoadingPaths.delete(path);
      }
      set({ loadingPaths: newLoadingPaths });
    },

    reset: () => set(initialState),
  })
);

