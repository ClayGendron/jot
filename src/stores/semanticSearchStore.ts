/**
 * Semantic Search Store
 *
 * Manages state for the semantic search feature including:
 * - Feature enable/disable status
 * - Indexed folders
 * - Search state and results
 * - Related documents
 * - Indexing progress
 */

import { create } from "zustand";
import type {
  SemanticSearchResult,
  RelatedDocument,
  IndexedFolder,
  IndexingProgress,
  SemanticStatus,
  SemanticSearchSettings,
} from "@/lib/semantic/types";
import { DEFAULT_SEMANTIC_SETTINGS } from "@/lib/semantic/types";
import {
  initSemanticModel,
  getSemanticStatus,
  addIndexedFolder,
  removeIndexedFolder,
  getIndexedFolders,
  semanticSearch,
  getRelatedDocuments,
  clearAllSemanticData,
} from "@/lib/tauri/semantic";

export interface SemanticSearchState {
  // Feature state
  enabled: boolean;
  modelLoaded: boolean;
  modelLoading: boolean;
  modelError: string | null;

  // Indexed folders
  indexedFolders: IndexedFolder[];

  // Search state
  searchQuery: string;
  searchResults: SemanticSearchResult[];
  isSearching: boolean;
  searchError: string | null;

  // Related documents
  currentFilePath: string | null;
  relatedDocuments: RelatedDocument[];
  isLoadingRelated: boolean;

  // Indexing state
  isIndexing: boolean;
  indexingProgress: IndexingProgress | null;

  // Setup dialog
  showSetupDialog: boolean;
}

export interface SemanticSearchActions {
  // Initialization
  initializeModel: () => Promise<boolean>;
  loadStatus: () => Promise<void>;
  loadSettings: (settings: SemanticSearchSettings | undefined) => void;

  // Feature management
  enableSemanticSearch: () => void;
  disableSemanticSearch: () => Promise<void>;

  // Folder management
  addFolder: (path: string, name: string) => Promise<void>;
  removeFolder: (path: string) => Promise<void>;
  loadFolders: () => Promise<void>;

  // Search
  setSearchQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  clearSearch: () => void;

  // Related documents
  findRelatedDocuments: (filePath: string) => Promise<void>;
  setRelatedDocuments: (documents: RelatedDocument[]) => void;
  clearRelatedDocuments: () => void;

  // Indexing
  setIndexingProgress: (progress: IndexingProgress | null) => void;
  setIsIndexing: (isIndexing: boolean) => void;

  // Setup
  showSetup: () => void;
  hideSetup: () => void;

  // Get settings for persistence
  getSettings: () => SemanticSearchSettings;
}

const initialState: SemanticSearchState = {
  enabled: false,
  modelLoaded: false,
  modelLoading: false,
  modelError: null,
  indexedFolders: [],
  searchQuery: "",
  searchResults: [],
  isSearching: false,
  searchError: null,
  currentFilePath: null,
  relatedDocuments: [],
  isLoadingRelated: false,
  isIndexing: false,
  indexingProgress: null,
  showSetupDialog: false,
};

export const useSemanticSearchStore = create<
  SemanticSearchState & SemanticSearchActions
>((set, get) => ({
  ...initialState,

  initializeModel: async () => {
    set({ modelLoading: true, modelError: null });
    try {
      const success = await initSemanticModel();
      set({ modelLoaded: success, modelLoading: false });
      return success;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize model";
      set({ modelError: message, modelLoading: false });
      return false;
    }
  },

  loadStatus: async () => {
    try {
      const status: SemanticStatus = await getSemanticStatus();
      set({
        modelLoaded: status.modelLoaded,
      });
    } catch (err) {
      console.error("Failed to load semantic status:", err);
    }
  },

  loadSettings: (settings: SemanticSearchSettings | undefined) => {
    if (settings) {
      set({
        enabled: settings.enabled,
        // indexedFolders will be loaded from database
      });
    } else {
      set({
        enabled: DEFAULT_SEMANTIC_SETTINGS.enabled,
      });
    }
  },

  enableSemanticSearch: () => {
    set({ showSetupDialog: true });
  },

  disableSemanticSearch: async () => {
    try {
      await clearAllSemanticData();
      set({
        enabled: false,
        indexedFolders: [],
        searchQuery: "",
        searchResults: [],
        relatedDocuments: [],
      });
    } catch (err) {
      console.error("Failed to disable semantic search:", err);
    }
  },

  addFolder: async (path: string, name: string) => {
    try {
      await addIndexedFolder(path, name);
      await get().loadFolders();
    } catch (err) {
      console.error("Failed to add indexed folder:", err);
    }
  },

  removeFolder: async (path: string) => {
    try {
      await removeIndexedFolder(path);
      await get().loadFolders();
    } catch (err) {
      console.error("Failed to remove indexed folder:", err);
    }
  },

  loadFolders: async () => {
    try {
      const folders = await getIndexedFolders();
      set({ indexedFolders: folders });
    } catch (err) {
      console.error("Failed to load indexed folders:", err);
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  search: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [], searchError: null });
      return;
    }

    set({ isSearching: true, searchError: null, searchQuery: query });
    try {
      const results = await semanticSearch(query, 20);
      set({ searchResults: results, isSearching: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Search failed";
      set({ searchError: message, isSearching: false });
    }
  },

  clearSearch: () => {
    set({ searchQuery: "", searchResults: [], searchError: null });
  },

  findRelatedDocuments: async (filePath: string) => {
    set({ isLoadingRelated: true, currentFilePath: filePath });
    try {
      const related = await getRelatedDocuments(filePath, 10);
      set({ relatedDocuments: related, isLoadingRelated: false });
    } catch (err) {
      console.error("Failed to find related documents:", err);
      set({ relatedDocuments: [], isLoadingRelated: false });
    }
  },

  setRelatedDocuments: (documents: RelatedDocument[]) => {
    set({ relatedDocuments: documents });
  },

  clearRelatedDocuments: () => {
    set({ relatedDocuments: [], currentFilePath: null });
  },

  setIndexingProgress: (progress: IndexingProgress | null) => {
    set({ indexingProgress: progress });
  },

  setIsIndexing: (isIndexing: boolean) => {
    set({ isIndexing });
    if (!isIndexing) {
      set({ indexingProgress: null });
    }
  },

  showSetup: () => {
    set({ showSetupDialog: true });
  },

  hideSetup: () => {
    set({ showSetupDialog: false });
  },

  getSettings: () => {
    const { enabled, indexedFolders } = get();
    return {
      enabled,
      indexedFolders: indexedFolders.map((f) => f.path),
      lastFullIndex: null, // TODO: track this
    };
  },
}));

/**
 * Hook for semantic search panel
 */
export function useSemanticSearch() {
  const searchQuery = useSemanticSearchStore((s) => s.searchQuery);
  const searchResults = useSemanticSearchStore((s) => s.searchResults);
  const isSearching = useSemanticSearchStore((s) => s.isSearching);
  const searchError = useSemanticSearchStore((s) => s.searchError);
  const setSearchQuery = useSemanticSearchStore((s) => s.setSearchQuery);
  const search = useSemanticSearchStore((s) => s.search);
  const clearSearch = useSemanticSearchStore((s) => s.clearSearch);

  return {
    searchQuery,
    searchResults,
    isSearching,
    searchError,
    setSearchQuery,
    search,
    clearSearch,
  };
}

/**
 * Hook for related documents panel
 */
export function useRelatedDocuments() {
  const currentFilePath = useSemanticSearchStore((s) => s.currentFilePath);
  const relatedDocuments = useSemanticSearchStore((s) => s.relatedDocuments);
  const isLoadingRelated = useSemanticSearchStore((s) => s.isLoadingRelated);
  const findRelatedDocuments = useSemanticSearchStore(
    (s) => s.findRelatedDocuments
  );
  const clearRelatedDocuments = useSemanticSearchStore(
    (s) => s.clearRelatedDocuments
  );

  return {
    currentFilePath,
    relatedDocuments,
    isLoadingRelated,
    findRelatedDocuments,
    clearRelatedDocuments,
  };
}
