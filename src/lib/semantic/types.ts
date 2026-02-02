/**
 * Semantic Search Type Definitions
 *
 * Types for the semantic search feature including document chunks,
 * search results, and indexing status.
 */

/**
 * A chunk of text extracted from a document
 */
export interface DocumentChunk {
  /** Full path to the source file */
  filePath: string;
  /** Index of this chunk within the file (0-based) */
  chunkIndex: number;
  /** The chunk text content */
  text: string;
  /** Start byte offset in the original file */
  startOffset: number;
  /** End byte offset in the original file */
  endOffset: number;
}

/**
 * Semantic search result
 */
export interface SemanticSearchResult {
  /** Full path to the matching file */
  filePath: string;
  /** File name only */
  fileName: string;
  /** Similarity score (0.0 to 1.0) */
  score: number;
  /** The matched chunk text */
  chunkText: string;
  /** Index of the matched chunk */
  chunkIndex: number;
}

/**
 * Related document result
 */
export interface RelatedDocument {
  /** Full path to the related file */
  filePath: string;
  /** File name only */
  fileName: string;
  /** Similarity score (0.0 to 1.0) */
  score: number;
  /** Preview text snippet (optional) */
  preview?: string;
}

/**
 * An indexed folder entry
 */
export interface IndexedFolder {
  /** Full path to the folder */
  path: string;
  /** Display name */
  name: string;
  /** Timestamp when folder was added (Unix ms) */
  addedAt: number;
  /** Timestamp of last full index (Unix ms), null if never indexed */
  lastIndexed: number | null;
}

/**
 * Indexing progress update
 */
export interface IndexingProgress {
  /** Current file number being processed */
  current: number;
  /** Total number of files to process */
  total: number;
  /** Name of the current file being processed */
  currentFile: string;
}

/**
 * Semantic search status
 */
export interface SemanticStatus {
  /** Whether the embedding model is loaded */
  modelLoaded: boolean;
  /** Number of folders being indexed */
  indexedFoldersCount: number;
  /** Total number of document chunks in the index */
  totalChunks: number;
  /** Total number of unique files in the index */
  totalFiles: number;
}

/**
 * Semantic search settings stored in global app settings
 */
export interface SemanticSearchSettings {
  /** Whether semantic search is enabled */
  enabled: boolean;
  /** List of indexed folder paths */
  indexedFolders: string[];
  /** Last time a full index was run (Unix ms) */
  lastFullIndex: number | null;
}

/**
 * Default semantic search settings
 */
export const DEFAULT_SEMANTIC_SETTINGS: SemanticSearchSettings = {
  enabled: false,
  indexedFolders: [],
  lastFullIndex: null,
};
