import { useCallback, useEffect, useRef } from "react";
import { useTabsStore, selectActiveFilePath, selectActiveIsDirty } from "@/stores/tabsStore";
import { saveDocumentPipeline } from "@/services/saveService";
import {
  readCrashRecoveryData,
  clearAllCrashRecovery,
  type CrashRecoveryMap,
} from "@/lib/crashRecovery";

const AUTOSAVE_DELAY_MS = 1000;
const SAVED_INDICATOR_DURATION_MS = 2000;

/**
 * Hook for automatic saving with debounce and crash recovery
 *
 * Features:
 * - Saves after 1 second of inactivity
 * - Shows "Saving..." / "Saved" indicators
 * - Crash recovery data is stored per-tab in tabsStore.updateTabContent
 * - Crash recovery data is cleared per-file in saveService on successful save
 * - Recovers content on next launch if crash detected
 * - Uses unified save pipeline for consistent behavior
 *
 * IMPORTANT: Tab ID is captured at debounce schedule time (not save time)
 * to prevent race condition where user switches tabs during save.
 */
export function useAutosave(content: string) {
  const filePath = useTabsStore(selectActiveFilePath);
  const isDirty = useTabsStore(selectActiveIsDirty);
  const setSaveStatus = useTabsStore((s) => s.setSaveStatus);
  const activeTabId = useTabsStore((state) => state.activeTabId);

  // Track if a save is currently in progress
  const isSavingRef = useRef(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  /**
   * Perform the actual save using the unified pipeline.
   * Takes tabId as parameter to avoid race condition - the ID is captured
   * when the debounce is scheduled, not when the save executes.
   */
  const performSave = useCallback(
    async (tabIdToSave: string) => {
      if (isSavingRef.current) return;

      isSavingRef.current = true;

      try {
        // Use unified save pipeline - it handles:
        // - Writing to disk
        // - Version history
        // - Hash computation
        // - Backlinks index update
        // - Store state updates
        // - Clearing per-file crash recovery on clean save
        const result = await saveDocumentPipeline(tabIdToSave, true);

        if (result.saved && result.isClean) {
          // Clear any pending indicator timeout
          if (savedIndicatorTimeoutRef.current) {
            clearTimeout(savedIndicatorTimeoutRef.current);
          }

          // Reset to idle after showing "Saved" for a bit
          savedIndicatorTimeoutRef.current = setTimeout(() => {
            setSaveStatus("idle");
          }, SAVED_INDICATOR_DURATION_MS);
        }
        // If saved but not clean (content changed during save), pipeline already set status to idle
      } catch (error) {
        // Pipeline already sets error status, but log for debugging
        console.error("Autosave failed:", error);
      } finally {
        isSavingRef.current = false;
      }
    },
    [setSaveStatus]
  );

  // Debounced autosave effect
  useEffect(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Only autosave if there's a file path and content has changed
    if (!filePath || !isDirty || !activeTabId) return;

    // Crash recovery is now handled in tabsStore.updateTabContent — no need to store here

    // CRITICAL: Capture tab ID NOW at schedule time, not at save time
    // This prevents the race condition where user switches tabs during save
    const tabIdToSave = activeTabId;

    // Schedule save after delay
    saveTimeoutRef.current = setTimeout(() => {
      performSave(tabIdToSave);
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [filePath, isDirty, content, activeTabId, performSave]);

  // Manual save function (for Cmd+S)
  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (savedIndicatorTimeoutRef.current) {
      clearTimeout(savedIndicatorTimeoutRef.current);
    }

    // Use current active tab for manual save
    const currentTabId = useTabsStore.getState().activeTabId;
    if (currentTabId) {
      performSave(currentTabId);
    }
  }, [performSave]);

  // Check for crash recovery data on mount
  const checkCrashRecovery = useCallback((): CrashRecoveryMap => {
    return readCrashRecoveryData();
  }, []);

  // Clear crash recovery data after user accepts or declines recovery.
  // App.tsx handles opening tabs and setting content.
  const recoverFromCrash = useCallback(
    (_recoveryMap: CrashRecoveryMap) => {
      clearAllCrashRecovery();
    },
    []
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      if (savedIndicatorTimeoutRef.current) {
        clearTimeout(savedIndicatorTimeoutRef.current);
      }
    };
  }, []);

  return {
    saveNow,
    checkCrashRecovery,
    recoverFromCrash,
    isSaving: isSavingRef.current,
  };
}

export default useAutosave;
