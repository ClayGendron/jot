import { useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useTabsStore } from "@/stores/tabsStore";
import { saveDocumentPipeline } from "@/services/saveService";

const AUTOSAVE_DELAY_MS = 1000;
const SAVED_INDICATOR_DURATION_MS = 2000;
const CRASH_RECOVERY_KEY = "jot_crash_recovery";

interface CrashRecoveryData {
  filePath: string | null;
  content: string;
  timestamp: number;
}

/**
 * Validates that an object matches CrashRecoveryData shape
 */
function isValidCrashRecoveryData(data: unknown): data is CrashRecoveryData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    (typeof obj.filePath === "string" || obj.filePath === null) &&
    typeof obj.content === "string" &&
    typeof obj.timestamp === "number"
  );
}

/**
 * Hook for automatic saving with debounce and crash recovery
 *
 * Features:
 * - Saves after 1 second of inactivity
 * - Shows "Saving..." / "Saved" indicators
 * - Stores content in localStorage for crash recovery
 * - Recovers content on next launch if crash detected
 * - Uses unified save pipeline for consistent behavior
 *
 * IMPORTANT: Tab ID is captured at debounce schedule time (not save time)
 * to prevent race condition where user switches tabs during save.
 */
export function useAutosave(content: string) {
  const { filePath, isDirty, setSaveStatus, setContent } = useEditorStore();
  const activeTabId = useTabsStore((state) => state.activeTabId);

  // Track if a save is currently in progress
  const isSavingRef = useRef(false);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Store content for crash recovery
  const storeCrashRecovery = useCallback((data: CrashRecoveryData) => {
    try {
      localStorage.setItem(CRASH_RECOVERY_KEY, JSON.stringify(data));
    } catch {
      // localStorage might be full or unavailable
    }
  }, []);

  // Clear crash recovery data after successful save
  const clearCrashRecovery = useCallback(() => {
    try {
      localStorage.removeItem(CRASH_RECOVERY_KEY);
    } catch {
      // Ignore errors
    }
  }, []);

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
        // - HTML to Markdown conversion
        // - Writing to disk
        // - Version history
        // - Hash computation
        // - Backlinks index update
        // - Store state updates
        const saved = await saveDocumentPipeline(tabIdToSave, true);

        if (saved) {
          clearCrashRecovery();

          // Clear any pending indicator timeout
          if (savedIndicatorTimeoutRef.current) {
            clearTimeout(savedIndicatorTimeoutRef.current);
          }

          // Reset to idle after showing "Saved" for a bit
          savedIndicatorTimeoutRef.current = setTimeout(() => {
            setSaveStatus("idle");
          }, SAVED_INDICATOR_DURATION_MS);
        }
      } catch (error) {
        // Pipeline already sets error status, but log for debugging
        console.error("Autosave failed:", error);
      } finally {
        isSavingRef.current = false;
      }
    },
    [setSaveStatus, clearCrashRecovery]
  );

  // Debounced autosave effect
  useEffect(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Only autosave if there's a file path and content has changed
    if (!filePath || !isDirty || !activeTabId) return;

    // Store for crash recovery immediately
    storeCrashRecovery({
      filePath,
      content,
      timestamp: Date.now(),
    });

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
  }, [filePath, isDirty, content, activeTabId, performSave, storeCrashRecovery]);

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
  const checkCrashRecovery = useCallback((): CrashRecoveryData | null => {
    try {
      const data = localStorage.getItem(CRASH_RECOVERY_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        // Validate the shape of the data
        if (!isValidCrashRecoveryData(parsed)) {
          clearCrashRecovery();
          return null;
        }
        // Only consider recovery data from last 24 hours
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp < ONE_DAY_MS) {
          return parsed;
        }
        // Clear stale recovery data
        clearCrashRecovery();
      }
    } catch {
      // Invalid data, clear it
      clearCrashRecovery();
    }
    return null;
  }, [clearCrashRecovery]);

  // Recover from crash
  const recoverFromCrash = useCallback(
    (recoveryData: CrashRecoveryData) => {
      setContent(recoveryData.content);
      clearCrashRecovery();
    },
    [setContent, clearCrashRecovery]
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
