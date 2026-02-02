/**
 * Semantic Indexing Service
 *
 * Handles document indexing for semantic search:
 * - Incremental indexing on file save (debounced)
 * - Full folder reindexing
 * - Manages indexing queue and progress
 */

import { readFile, type FileEntry } from "@/lib/tauri/files";
import { chunkMarkdown, computeContentHash } from "@/lib/semantic";
import {
  embedAndStore,
  deleteFileEmbeddings,
  fileNeedsUpdate,
  updateFolderIndexed,
  getIndexedFolders,
} from "@/lib/tauri/semantic";
import { useSemanticSearchStore } from "@/stores/semanticSearchStore";

// Debounce configuration
const INDEX_DEBOUNCE_MS = 2000;

// Track pending indexing operations
const pendingIndexQueue = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Queue a file for indexing (debounced).
 * Called after a file is saved.
 */
export function queueFileForIndexing(filePath: string): void {
  const { enabled, indexedFolders } = useSemanticSearchStore.getState();

  if (!enabled) return;

  // Check if file is in an indexed folder
  const isInIndexedFolder = indexedFolders.some((folder) =>
    filePath.startsWith(folder.path)
  );

  if (!isInIndexedFolder) return;

  // Clear any pending index for this file
  const pending = pendingIndexQueue.get(filePath);
  if (pending) {
    clearTimeout(pending);
  }

  // Schedule new index operation
  const timeoutId = setTimeout(async () => {
    pendingIndexQueue.delete(filePath);
    await indexSingleFile(filePath, null);
  }, INDEX_DEBOUNCE_MS);

  pendingIndexQueue.set(filePath, timeoutId);
}

/**
 * Index a single file.
 * @param filePath - Path to the markdown file
 * @param workspacePath - Workspace path for reading the file (null to skip reading, content must be provided)
 * @param content - Optional content to index (if null, reads from disk)
 */
export async function indexSingleFile(
  filePath: string,
  workspacePath: string | null,
  content?: string
): Promise<boolean> {
  try {
    // If no content provided, determine workspace and read file
    let markdown = content;
    let workspace = workspacePath;

    if (!markdown) {
      // Find which indexed folder this file belongs to
      const { indexedFolders } = useSemanticSearchStore.getState();
      const folder = indexedFolders.find((f) => filePath.startsWith(f.path));

      if (!folder) {
        return false;
      }

      workspace = folder.path;

      try {
        markdown = await readFile(filePath, workspace);
      } catch (err) {
        console.error(`Failed to read file for indexing: ${filePath}`, err);
        return false;
      }
    }

    // Check if file needs update (content hash changed)
    const contentHash = computeContentHash(markdown);
    const needsUpdate = await fileNeedsUpdate(filePath, contentHash);

    if (!needsUpdate) {
      return true; // Already indexed with same content
    }

    // Delete existing embeddings for this file
    await deleteFileEmbeddings(filePath);

    // Chunk the markdown
    const chunks = chunkMarkdown(markdown, filePath);

    if (chunks.length === 0) {
      return true; // Empty file, nothing to index
    }

    // Embed and store chunks
    await embedAndStore(chunks);

    return true;
  } catch (err) {
    console.error(`Failed to index file: ${filePath}`, err);
    return false;
  }
}

/**
 * Index all files in an indexed folder.
 * Reports progress via the store.
 */
export async function indexFolder(
  folderPath: string,
  onProgress?: (current: number, total: number, currentFile: string) => void
): Promise<{ success: number; failed: number }> {
  const result = { success: 0, failed: 0 };

  try {
    // Collect all markdown files in the folder
    const files = await collectMarkdownFiles(folderPath);

    if (files.length === 0) {
      return result;
    }

    // Update store with indexing status
    useSemanticSearchStore.getState().setIsIndexing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Report progress
      useSemanticSearchStore.getState().setIndexingProgress({
        current: i + 1,
        total: files.length,
        currentFile: file,
      });

      if (onProgress) {
        onProgress(i + 1, files.length, file);
      }

      // Index the file
      const success = await indexSingleFile(file, folderPath);

      if (success) {
        result.success++;
      } else {
        result.failed++;
      }
    }

    // Update folder's last indexed timestamp
    await updateFolderIndexed(folderPath);
  } catch (err) {
    console.error(`Failed to index folder: ${folderPath}`, err);
  } finally {
    // Clear indexing status
    useSemanticSearchStore.getState().setIsIndexing(false);
    useSemanticSearchStore.getState().setIndexingProgress(null);
  }

  return result;
}

/**
 * Index all indexed folders.
 */
export async function indexAllFolders(): Promise<{
  success: number;
  failed: number;
}> {
  const totals = { success: 0, failed: 0 };

  try {
    const folders = await getIndexedFolders();

    for (const folder of folders) {
      const result = await indexFolder(folder.path);
      totals.success += result.success;
      totals.failed += result.failed;
    }
  } catch (err) {
    console.error("Failed to index all folders:", err);
  }

  return totals;
}

/**
 * Collect all markdown files in a folder recursively.
 */
async function collectMarkdownFiles(folderPath: string): Promise<string[]> {
  const files: string[] = [];

  // Use Tauri to read directory
  // For now, we'll use a simple approach via the existing API
  // In a full implementation, we'd add a dedicated Tauri command

  try {
    // Import dynamically to avoid circular deps
    const { readDirectory } = await import("@/lib/tauri/files");
    const entries = await readDirectory(folderPath);

    const collectFromEntries = (entries: FileEntry[]) => {
      for (const entry of entries) {
        if (entry.is_markdown) {
          files.push(entry.path);
        }
        if (entry.children) {
          collectFromEntries(entry.children);
        }
      }
    };

    collectFromEntries(entries);
  } catch (err) {
    console.error(`Failed to collect files from ${folderPath}:`, err);
  }

  return files;
}

/**
 * Remove a file from the index.
 * Called when a file is deleted.
 */
export async function removeFileFromIndex(filePath: string): Promise<void> {
  try {
    await deleteFileEmbeddings(filePath);
  } catch (err) {
    console.error(`Failed to remove file from index: ${filePath}`, err);
  }
}

/**
 * Clear pending indexing operations.
 * Called when disabling semantic search.
 */
export function clearPendingIndexOperations(): void {
  for (const [, timeoutId] of pendingIndexQueue) {
    clearTimeout(timeoutId);
  }
  pendingIndexQueue.clear();
}
