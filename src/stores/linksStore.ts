/**
 * Links state management using Zustand
 *
 * Manages the backlinks index and related state.
 * Supports both full index rebuild and incremental updates.
 */

import { create } from "zustand";
import {
  buildBacklinksIndex,
  getBacklinksForFile,
  type BacklinksIndex,
  type BacklinkEntry,
  type FileContent,
} from "@/lib/links/backlinks";
import { extractInternalLinks } from "@/lib/markdown/parser";

export interface LinksState {
  /** The backlinks index mapping targets to their backlinks */
  backlinksIndex: BacklinksIndex;
  /** Whether the index is currently being built */
  isIndexing: boolean;
  /** Last time the index was updated */
  lastIndexed: Date | null;
  /** Hash of each indexed file for change detection */
  fileHashes: Record<string, string>;

  // Actions
  /** Build/rebuild the backlinks index from file contents */
  buildIndex: (files: FileContent[], workspacePath: string) => void;
  /** Get backlinks for a specific file path */
  getBacklinks: (filePath: string) => BacklinkEntry[];
  /** Clear the index */
  clearIndex: () => void;
  /** Update hash for a specific file */
  setFileHash: (filePath: string, hash: string) => void;
  /** Update backlinks index for a single file (incremental update) */
  updateFileInIndex: (
    filePath: string,
    markdownContent: string,
    workspacePath: string
  ) => void;
  /** Remove a file from the index (when deleted) */
  removeFileFromIndex: (filePath: string) => void;
}

export const useLinksStore = create<LinksState>((set, get) => ({
  backlinksIndex: {},
  isIndexing: false,
  lastIndexed: null,
  fileHashes: {},

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
      fileHashes: {},
    });
  },

  setFileHash: (filePath, hash) => {
    set((state) => ({
      fileHashes: { ...state.fileHashes, [filePath]: hash },
    }));
  },

  updateFileInIndex: (filePath, markdownContent, workspacePath) => {
    const state = get();
    const newIndex = { ...state.backlinksIndex };

    // 1. Remove all old backlinks FROM this file
    // (links that point TO other files, where this file is the source)
    for (const targetPath of Object.keys(newIndex)) {
      newIndex[targetPath] = newIndex[targetPath].filter(
        (entry) => entry.sourcePath !== filePath
      );
      // Clean up empty arrays
      if (newIndex[targetPath].length === 0) {
        delete newIndex[targetPath];
      }
    }

    // 2. Extract new links from the updated content
    const links = extractInternalLinks(markdownContent);
    const fileName = filePath.split("/").pop() || filePath;
    const sourceName = fileName.replace(/\.md$/, "");

    // 3. Add new backlinks
    for (const link of links) {
      // Resolve the target path (same logic as buildBacklinksIndex)
      const withExt = link.target.endsWith(".md")
        ? link.target
        : `${link.target}.md`;
      const targetPath = withExt.startsWith("/")
        ? withExt
        : `${workspacePath}/${withExt}`;

      if (!newIndex[targetPath]) {
        newIndex[targetPath] = [];
      }

      // Extract context around the link
      const contextRadius = 50;
      const linkIndex = markdownContent.indexOf(link.raw);
      let context = "";
      if (linkIndex !== -1) {
        const start = Math.max(0, linkIndex - contextRadius);
        const end = Math.min(
          markdownContent.length,
          linkIndex + link.raw.length + contextRadius
        );
        context = markdownContent.slice(start, end);
        if (start > 0) context = "..." + context;
        if (end < markdownContent.length) context = context + "...";
        context = context.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
      }

      newIndex[targetPath].push({
        sourcePath: filePath,
        sourceName,
        linkText: link.displayText || link.target,
        context,
      });
    }

    set({
      backlinksIndex: newIndex,
      lastIndexed: new Date(),
    });
  },

  removeFileFromIndex: (filePath) => {
    const state = get();
    const newIndex = { ...state.backlinksIndex };
    const newHashes = { ...state.fileHashes };

    // Remove backlinks FROM this file
    for (const targetPath of Object.keys(newIndex)) {
      newIndex[targetPath] = newIndex[targetPath].filter(
        (entry) => entry.sourcePath !== filePath
      );
      if (newIndex[targetPath].length === 0) {
        delete newIndex[targetPath];
      }
    }

    // Remove backlinks TO this file
    delete newIndex[filePath];

    // Remove hash
    delete newHashes[filePath];

    set({
      backlinksIndex: newIndex,
      fileHashes: newHashes,
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
