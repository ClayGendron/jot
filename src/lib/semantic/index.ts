/**
 * Semantic Search Module
 *
 * Provides on-device semantic search using ML embeddings.
 */

// Types
export type {
  DocumentChunk,
  SemanticSearchResult,
  RelatedDocument,
  IndexedFolder,
  IndexingProgress,
  SemanticStatus,
  SemanticSearchSettings,
} from "./types";

export { DEFAULT_SEMANTIC_SETTINGS } from "./types";

// Chunking utilities
export {
  chunkMarkdown,
  estimateTokens,
  computeContentHash,
} from "./markdownChunker";
