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
 * 3. Convert HTML → Markdown
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
 * Unified save pipeline - ALL save paths must use this.
 * Ensures consistency: write → version history → hash → store → index
 *
 * @param tabId - Tab to save
 * @param isActiveDoc - If true, update SaveIndicator; if false, save silently
 * @returns true if save succeeded, false if skipped (not dirty or not found)
 */
export async function saveDocumentPipeline(
  tabId: string,
  isActiveDoc: boolean
): Promise<boolean> {
  const tab = useTabsStore.getState().tabs.find((t) => t.id === tabId);

  // Guard: no-op if tab not found or not dirty
  if (!tab) {
    console.warn(`saveDocumentPipeline: Tab ${tabId} not found`);
    return false;
  }

  if (!tab.isDirty) {
    return false; // Nothing to save
  }

  const workspacePath = useWorkspaceStore.getState().workspacePath;

  // 1. Update SaveIndicator for active doc only
  if (isActiveDoc) {
    useEditorStore.getState().setSaveStatus("saving");
  }

  try {
    // 2. Convert HTML → Markdown
    const markdown = htmlToMarkdown(tab.content);

    // 3. Normalize line endings for consistent hashing
    const normalizedMarkdown = markdown.replace(/\r\n/g, "\n");

    // 4. Write to disk
    await writeFile(tab.filePath, normalizedMarkdown);

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

    // 7. Update store state
    useTabsStore.getState().markTabSaved(tabId);
    useLinksStore.getState().setFileHash(tab.filePath, hash);

    // 8. Also mark editor store as saved (for active doc sync)
    if (isActiveDoc) {
      useEditorStore.getState().markSaved();
    }

    // 9. Update backlinks index for this file
    if (workspacePath) {
      useLinksStore.getState().updateFileInIndex(
        tab.filePath,
        normalizedMarkdown,
        workspacePath
      );
    }

    // 10. Update SaveIndicator for active doc
    if (isActiveDoc) {
      useEditorStore.getState().setSaveStatus("saved");
    }

    return true;
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
 * @returns true if save succeeded
 */
export async function saveDocumentByPath(
  filePath: string,
  isActiveDoc: boolean
): Promise<boolean> {
  const tab = useTabsStore.getState().tabs.find((t) => t.filePath === filePath);

  if (!tab) {
    console.warn(`saveDocumentByPath: No tab found for ${filePath}`);
    return false;
  }

  return saveDocumentPipeline(tab.id, isActiveDoc);
}
