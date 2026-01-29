import { useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { writeFile } from "@/lib/tauri/files";
import { htmlToMarkdown } from "@/lib/markdown/htmlToMarkdown";
import { saveVersion } from "@/lib/tauri/versionHistory";

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
 * - Uses refs to always save latest content (avoids stale closures)
 */
export function useAutosave(content: string) {
  const { filePath, isDirty, markSaved, setSaveStatus, setContent } =
    useEditorStore();
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);

  // Use refs to avoid stale closure issues in debounced saves
  const contentRef = useRef(content);
  const filePathRef = useRef(filePath);
  const workspacePathRef = useRef(workspacePath);
  const isDirtyRef = useRef(isDirty);
  const isSavingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);

  useEffect(() => {
    workspacePathRef.current = workspacePath;
  }, [workspacePath]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

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

  // Perform the actual save - uses refs to get latest values
  const performSave = useCallback(async () => {
    const currentFilePath = filePathRef.current;
    const currentContent = contentRef.current;
    const currentIsDirty = isDirtyRef.current;
    const currentWorkspacePath = workspacePathRef.current;

    if (!currentFilePath || !currentIsDirty || isSavingRef.current) return;

    isSavingRef.current = true;
    setSaveStatus("saving");

    try {
      // Convert HTML to Markdown before saving (canonical format on disk is Markdown)
      const markdownContent = htmlToMarkdown(currentContent);
      await writeFile(currentFilePath, markdownContent);

      // Save version snapshot (only if workspace is open)
      if (currentWorkspacePath) {
        try {
          await saveVersion(currentWorkspacePath, currentFilePath, markdownContent);
        } catch (versionError) {
          // Version history is non-critical - log but don't fail the save
          console.warn("Failed to save version:", versionError);
        }
      }

      markSaved();
      setSaveStatus("saved");
      clearCrashRecovery();

      // Clear any pending indicator timeout
      if (savedIndicatorTimeoutRef.current) {
        clearTimeout(savedIndicatorTimeoutRef.current);
      }

      // Reset to idle after showing "Saved" for a bit
      savedIndicatorTimeoutRef.current = setTimeout(() => {
        setSaveStatus("idle");
      }, SAVED_INDICATOR_DURATION_MS);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to save file";
      setSaveStatus("error", errorMessage);
      console.error("Autosave failed:", error);
    } finally {
      isSavingRef.current = false;
    }
  }, [markSaved, setSaveStatus, clearCrashRecovery]);

  // Debounced autosave effect
  useEffect(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Only autosave if there's a file path and content has changed
    if (!filePath || !isDirty) return;

    // Store for crash recovery immediately
    storeCrashRecovery({
      filePath,
      content,
      timestamp: Date.now(),
    });

    // Schedule save after delay
    saveTimeoutRef.current = setTimeout(performSave, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [filePath, isDirty, content, performSave, storeCrashRecovery]);

  // Manual save function (for Cmd+S)
  const saveNow = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (savedIndicatorTimeoutRef.current) {
      clearTimeout(savedIndicatorTimeoutRef.current);
    }
    performSave();
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
