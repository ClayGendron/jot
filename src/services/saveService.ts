/**
 * Unified Save Pipeline
 *
 * ALL save paths must use this service to ensure consistency:
 * - Autosave (active document)
 * - Manual save (Cmd+S)
 * - Tab close with save
 * - Workspace switch with save all
 *
 * Pipeline:
 * 1. Validate tab exists and is dirty
 * 2. Update SaveIndicator (active doc only)
 * 3. Convert HTML → Markdown (TipTap only; CodeMirror content is already Markdown)
 * 4. Normalize line endings
 * 5. Write to disk
 * 6. Save version history
 * 7. Compute hash and update store
 * 8. Update backlinks index
 * 9. Mark tab as saved
 */

import { htmlToMarkdown } from "@/lib/markdown/htmlToMarkdown";
import { writeFile } from "@/lib/tauri/files";
import { saveVersion } from "@/lib/tauri/versionHistory";
import { useTabsStore } from "@/stores/tabsStore";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useLinksStore } from "@/stores/linksStore";
import { queueFileForIndexing } from "./semanticIndexingService";

/**
 * Compute a simple hash for change detection.
 * Not cryptographic - just for detecting content changes.
 * Content should already be normalized (LF line endings).
 */
export function computeSimpleHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(16);
}

/**
 * Result of a save operation
 */
export interface SaveResult {
  /** Whether the save operation was attempted and succeeded */
  saved: boolean;
  /** Whether the document is now clean (no unsaved changes) */
  isClean: boolean;
}

/**
 * Unified save pipeline - ALL save paths must use this.
 * Ensures consistency: write → version history → hash → store → index
 *
 * @param tabId - Tab to save
 * @param isActiveDoc - If true, update SaveIndicator; if false, save silently
 * @returns SaveResult with saved (operation succeeded) and isClean (no pending changes)
 */
export async function saveDocumentPipeline(
  tabId: string,
  isActiveDoc: boolean
): Promise<SaveResult> {
  const tab = useTabsStore.getState().tabs.find((t) => t.id === tabId);

  // Guard: no-op if tab not found or not dirty
  if (!tab) {
    console.warn(`saveDocumentPipeline: Tab ${tabId} not found`);
    return { saved: false, isClean: false };
  }

  if (!tab.isDirty) {
    return { saved: false, isClean: true }; // Already clean, nothing to save
  }

  // Capture content snapshot at START of save
  // Used to detect if content changed during async save
  const contentAtSaveStart = tab.content;

  const workspacePath = useWorkspaceStore.getState().workspacePath;
  const useMarkdownEditor = useEditorStore.getState().useMarkdownEditor;

  // 1. Update SaveIndicator for active doc only
  if (isActiveDoc) {
    useEditorStore.getState().setSaveStatus("saving");
  }

  try {
    // 2. Get Markdown content:
    // - CodeMirror: content is already Markdown, use directly
    // - TipTap: convert HTML → Markdown
    const markdown = useMarkdownEditor ? contentAtSaveStart : htmlToMarkdown(contentAtSaveStart);

    // 3. Normalize line endings for consistent hashing
    const normalizedMarkdown = markdown.replace(/\r\n/g, "\n");

    // 4. Write to disk (requires workspace path for security validation)
    if (!workspacePath) {
      throw new Error("Cannot save: no workspace is open");
    }
    await writeFile(tab.filePath, normalizedMarkdown, workspacePath);

    // 5. Save version history (only if workspace is open)
    if (workspacePath) {
      try {
        await saveVersion(workspacePath, tab.filePath, normalizedMarkdown);
      } catch (versionError) {
        // Version history is non-critical - log but don't fail the save
        console.warn("Failed to save version:", versionError);
      }
    }

    // 6. Compute hash
    const hash = computeSimpleHash(normalizedMarkdown);

    // 7. Update hash in links store
    useLinksStore.getState().setFileHash(tab.filePath, hash);

    // 8. GUARD: Check if content changed during save using EXACT content comparison
    // If user edited while save was in progress, don't mark as saved
    const currentTab = useTabsStore.getState().tabs.find((t) => t.id === tabId);
    const contentUnchanged = Boolean(currentTab && currentTab.content === contentAtSaveStart);

    if (contentUnchanged) {
      // Content unchanged during save - safe to mark as saved
      useTabsStore.getState().markTabSaved(tabId);
      if (isActiveDoc) {
        useEditorStore.getState().markSaved();
        useEditorStore.getState().setSaveStatus("saved");
      }
    } else if (isActiveDoc) {
      // Content changed during save - show "saved" briefly but document is still dirty
      // Reset to idle immediately since we didn't actually finish saving everything
      useEditorStore.getState().setSaveStatus("idle");
    }
    // If content changed during save, leave isDirty=true (next autosave will handle it)

    // 9. Update backlinks index for this file
    if (workspacePath) {
      const caseSensitiveFs = useEditorStore.getState().isCaseSensitiveFs;
      useLinksStore.getState().updateFileInIndex(
        tab.filePath,
        normalizedMarkdown,
        workspacePath,
        caseSensitiveFs
      );
    }

    // 10. Queue for semantic search indexing (debounced, non-blocking)
    queueFileForIndexing(tab.filePath);

    return { saved: true, isClean: contentUnchanged };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to save file";

    if (isActiveDoc) {
      useEditorStore.getState().setSaveStatus("error", errorMessage);
    }

    console.error(`saveDocumentPipeline failed for ${tab.filePath}:`, error);
    throw error; // Re-throw so caller can handle
  }
}

/**
 * Save all dirty tabs.
 * Used when switching workspaces or closing all tabs.
 *
 * @param activeTabId - The currently active tab ID (for indicator updates)
 * @returns Array of tab IDs that failed to save
 */
export async function saveAllDirtyTabs(
  activeTabId: string | null
): Promise<string[]> {
  const dirtyTabs = useTabsStore
    .getState()
    .tabs.filter((t) => t.isDirty);

  const failedTabIds: string[] = [];

  for (const tab of dirtyTabs) {
    try {
      await saveDocumentPipeline(tab.id, tab.id === activeTabId);
    } catch {
      failedTabIds.push(tab.id);
    }
  }

  return failedTabIds;
}

/**
 * Save a specific tab by its file path.
 * Convenience wrapper for when you have a path but not an ID.
 *
 * @param filePath - Path of the file to save
 * @param isActiveDoc - Whether this is the active document
 * @returns SaveResult with saved (operation succeeded) and isClean (no pending changes)
 */
export async function saveDocumentByPath(
  filePath: string,
  isActiveDoc: boolean
): Promise<SaveResult> {
  const tab = useTabsStore.getState().tabs.find((t) => t.filePath === filePath);

  if (!tab) {
    console.warn(`saveDocumentByPath: No tab found for ${filePath}`);
    return { saved: false, isClean: false };
  }

  return saveDocumentPipeline(tab.id, isActiveDoc);
}
