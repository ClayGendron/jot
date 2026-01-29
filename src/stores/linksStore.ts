/**
 * Links state management using Zustand
 *
 * Manages the backlinks index and related state.
 */

import { create } from "zustand";
import {
  buildBacklinksIndex,
  getBacklinksForFile,
  type BacklinksIndex,
  type BacklinkEntry,
  type FileContent,
} from "@/lib/links/backlinks";

export interface LinksState {
  /** The backlinks index mapping targets to their backlinks */
  backlinksIndex: BacklinksIndex;
  /** Whether the index is currently being built */
  isIndexing: boolean;
  /** Last time the index was updated */
  lastIndexed: Date | null;

  // Actions
  /** Build/rebuild the backlinks index from file contents */
  buildIndex: (files: FileContent[], workspacePath: string) => void;
  /** Get backlinks for a specific file path */
  getBacklinks: (filePath: string) => BacklinkEntry[];
  /** Clear the index */
  clearIndex: () => void;
}

export const useLinksStore = create<LinksState>((set, get) => ({
  backlinksIndex: {},
  isIndexing: false,
  lastIndexed: null,

  buildIndex: (files, workspacePath) => {
    set({ isIndexing: true });

    // Build index synchronously (fast enough for most workspaces)
    const index = buildBacklinksIndex(files, workspacePath);

    set({
      backlinksIndex: index,
      isIndexing: false,
      lastIndexed: new Date(),
    });
  },

  getBacklinks: (filePath) => {
    return getBacklinksForFile(get().backlinksIndex, filePath);
  },

  clearIndex: () => {
    set({
      backlinksIndex: {},
      lastIndexed: null,
    });
  },
}));

/**
 * Selector to get backlinks for a specific file
 */
export function selectBacklinksForFile(filePath: string | null) {
  return (state: LinksState): BacklinkEntry[] => {
    if (!filePath) return [];
    return getBacklinksForFile(state.backlinksIndex, filePath);
  };
}

/**
 * Selector to get backlinks count for a file
 */
export function selectBacklinksCount(filePath: string | null) {
  return (state: LinksState): number => {
    if (!filePath) return 0;
    return getBacklinksForFile(state.backlinksIndex, filePath).length;
  };
}
