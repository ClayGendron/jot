/**
 * Tauri Bindings for Semantic Search
 *
 * TypeScript wrappers for Rust semantic search commands.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  DocumentChunk,
  SemanticSearchResult,
  RelatedDocument,
  IndexedFolder,
  SemanticStatus,
} from "@/lib/semantic/types";

// ==========================================
// Type Conversions (snake_case → camelCase)
// ==========================================

interface RawSemanticSearchResult {
  file_path: string;
  file_name: string;
  score: number;
  chunk_text: string;
  chunk_index: number;
}

interface RawRelatedDocument {
  file_path: string;
  file_name: string;
  score: number;
}

interface RawIndexedFolder {
  path: string;
  name: string;
  added_at: number;
  last_indexed: number | null;
}

interface RawSemanticStatus {
  model_loaded: boolean;
  indexed_folders_count: number;
  total_chunks: number;
  total_files: number;
  device: string;
}

interface RawDocumentChunk {
  file_path: string;
  chunk_index: number;
  text: string;
  start_offset: number;
  end_offset: number;
}

function convertSearchResult(raw: RawSemanticSearchResult): SemanticSearchResult {
  return {
    filePath: raw.file_path,
    fileName: raw.file_name,
    score: raw.score,
    chunkText: raw.chunk_text,
    chunkIndex: raw.chunk_index,
  };
}

function convertRelatedDocument(raw: RawRelatedDocument): RelatedDocument {
  return {
    filePath: raw.file_path,
    fileName: raw.file_name,
    score: raw.score,
  };
}

function convertIndexedFolder(raw: RawIndexedFolder): IndexedFolder {
  return {
    path: raw.path,
    name: raw.name,
    addedAt: raw.added_at,
    lastIndexed: raw.last_indexed,
  };
}

function convertStatus(raw: RawSemanticStatus): SemanticStatus {
  return {
    modelLoaded: raw.model_loaded,
    indexedFoldersCount: raw.indexed_folders_count,
    totalChunks: raw.total_chunks,
    totalFiles: raw.total_files,
    device: raw.device,
  };
}

function chunkToRaw(chunk: DocumentChunk): RawDocumentChunk {
  return {
    file_path: chunk.filePath,
    chunk_index: chunk.chunkIndex,
    text: chunk.text,
    start_offset: chunk.startOffset,
    end_offset: chunk.endOffset,
  };
}

// ==========================================
// Tauri Commands
// ==========================================

/**
 * Initialize the embedding model.
 * This downloads the model on first use (~23MB).
 * @returns true if initialization succeeded
 */
export async function initSemanticModel(): Promise<boolean> {
  return invoke<boolean>("jot_semantic_init");
}

/**
 * Get semantic search status (model loaded, index stats).
 */
export async function getSemanticStatus(): Promise<SemanticStatus> {
  const raw = await invoke<RawSemanticStatus>("jot_semantic_get_status");
  return convertStatus(raw);
}

/**
 * Add a folder to be indexed for semantic search.
 * @param path - Full path to the folder
 * @param name - Display name for the folder
 */
export async function addIndexedFolder(
  path: string,
  name: string
): Promise<void> {
  await invoke("jot_semantic_add_folder", { path, name });
}

/**
 * Remove a folder from semantic search index.
 * Also deletes all embeddings for files in that folder.
 * @param path - Full path to the folder
 * @returns Number of embeddings deleted
 */
export async function removeIndexedFolder(path: string): Promise<number> {
  return invoke<number>("jot_semantic_remove_folder", { path });
}

/**
 * Get list of indexed folders.
 */
export async function getIndexedFolders(): Promise<IndexedFolder[]> {
  const raw = await invoke<RawIndexedFolder[]>("jot_semantic_get_folders");
  return raw.map(convertIndexedFolder);
}

/**
 * Embed document chunks and store them in the index.
 * @param chunks - Array of document chunks to embed
 * @returns Number of chunks stored
 */
export async function embedAndStore(chunks: DocumentChunk[]): Promise<number> {
  const rawChunks = chunks.map(chunkToRaw);
  return invoke<number>("jot_semantic_embed_and_store", { chunks: rawChunks });
}

/**
 * Delete all embeddings for a file.
 * @param filePath - Full path to the file
 * @returns Number of chunks deleted
 */
export async function deleteFileEmbeddings(filePath: string): Promise<number> {
  return invoke<number>("jot_semantic_delete_file", { filePath });
}

/**
 * Check if a file needs re-indexing (content changed).
 * @param filePath - Full path to the file
 * @param contentHash - Hash of the current file content
 * @returns true if the file needs re-indexing
 */
export async function fileNeedsUpdate(
  filePath: string,
  contentHash: string
): Promise<boolean> {
  return invoke<boolean>("jot_semantic_file_needs_update", {
    filePath,
    contentHash,
  });
}

/**
 * Semantic search across all indexed documents.
 * @param query - The search query
 * @param limit - Maximum number of results (default 10)
 * @returns Array of search results sorted by relevance
 */
export async function semanticSearch(
  query: string,
  limit: number = 10
): Promise<SemanticSearchResult[]> {
  const raw = await invoke<RawSemanticSearchResult[]>("jot_semantic_search", {
    query,
    limit,
  });
  return raw.map(convertSearchResult);
}

/**
 * Get related documents for a file.
 * @param filePath - Full path to the file
 * @param limit - Maximum number of results (default 5)
 * @returns Array of related documents sorted by similarity
 */
export async function getRelatedDocuments(
  filePath: string,
  limit: number = 5
): Promise<RelatedDocument[]> {
  const raw = await invoke<RawRelatedDocument[]>("jot_semantic_get_related", {
    filePath,
    limit,
  });
  return raw.map(convertRelatedDocument);
}

/**
 * Update the last_indexed timestamp for a folder.
 * @param path - Full path to the folder
 */
export async function updateFolderIndexed(path: string): Promise<void> {
  await invoke("jot_semantic_update_folder_indexed", { path });
}

/**
 * Clear all semantic search data.
 */
export async function clearAllSemanticData(): Promise<void> {
  await invoke("jot_semantic_clear_all");
}
