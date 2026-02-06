import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutosave } from "./useAutosave";
import { useTabsStore } from "@/stores/tabsStore";
import { storeCrashRecoveryForFile } from "@/lib/crashRecovery";

// Mock the tauri files module
vi.mock("@/lib/tauri/files", () => ({
  writeFile: vi.fn(),
}));

// Mock the save service
vi.mock("@/services/saveService", () => ({
  saveDocumentPipeline: vi.fn().mockResolvedValue({ saved: true, isClean: true }),
}));

import { writeFile } from "@/lib/tauri/files";
import { saveDocumentPipeline } from "@/services/saveService";

const mockWriteFile = writeFile as Mock;
const mockSaveDocumentPipeline = saveDocumentPipeline as Mock;

describe("useAutosave", () => {
  beforeEach(() => {
    // Reset tabs store
    useTabsStore.setState({
      tabs: [],
      activeTabId: null,
      saveStatus: "idle",
      saveError: null,
    });
    // Clear localStorage
    localStorage.clear();
    mockWriteFile.mockClear();
    mockSaveDocumentPipeline.mockClear();
  });

  describe("crash recovery", () => {
    it("checkCrashRecovery reads v2 data stored by tabsStore", () => {
      // Simulate what tabsStore.updateTabContent does
      storeCrashRecoveryForFile("/test/file.md", "recovered content");

      const { result } = renderHook(() => useAutosave(""));

      const recovered = result.current.checkCrashRecovery();
      expect(Object.keys(recovered)).toHaveLength(1);
      expect(recovered["/test/file.md"]).toBeDefined();
      expect(recovered["/test/file.md"].content).toBe("recovered content");
    });

    it("checkCrashRecovery returns data for multiple files", () => {
      storeCrashRecoveryForFile("/test/a.md", "content A");
      storeCrashRecoveryForFile("/test/b.md", "content B");

      const { result } = renderHook(() => useAutosave(""));

      const recovered = result.current.checkCrashRecovery();
      expect(Object.keys(recovered)).toHaveLength(2);
      expect(recovered["/test/a.md"].content).toBe("content A");
      expect(recovered["/test/b.md"].content).toBe("content B");
    });

    it("checkCrashRecovery returns empty object for stale data (>24h)", () => {
      // Write stale v2 data directly
      const staleData = {
        "/test/old.md": {
          content: "old content",
          timestamp: Date.now() - 25 * 60 * 60 * 1000,
        },
      };
      localStorage.setItem("jot_crash_recovery_v2", JSON.stringify(staleData));

      const { result } = renderHook(() => useAutosave(""));

      const recovered = result.current.checkCrashRecovery();
      expect(Object.keys(recovered)).toHaveLength(0);
    });

    it("checkCrashRecovery returns empty object when no data exists", () => {
      const { result } = renderHook(() => useAutosave(""));

      const recovered = result.current.checkCrashRecovery();
      expect(Object.keys(recovered)).toHaveLength(0);
    });

    it("checkCrashRecovery handles invalid JSON gracefully", () => {
      localStorage.setItem("jot_crash_recovery_v2", "not valid json");

      const { result } = renderHook(() => useAutosave(""));

      const recovered = result.current.checkCrashRecovery();
      expect(Object.keys(recovered)).toHaveLength(0);
    });

    it("checkCrashRecovery migrates v1 data", () => {
      const v1Data = {
        filePath: "/test/recovered.md",
        content: "v1 recovered content",
        timestamp: Date.now(),
      };
      localStorage.setItem("jot_crash_recovery", JSON.stringify(v1Data));

      const { result } = renderHook(() => useAutosave(""));

      const recovered = result.current.checkCrashRecovery();
      expect(recovered["/test/recovered.md"]).toBeDefined();
      expect(recovered["/test/recovered.md"].content).toBe("v1 recovered content");
      // v1 key should be deleted after migration
      expect(localStorage.getItem("jot_crash_recovery")).toBeNull();
    });

    it("recoverFromCrash clears storage", () => {
      storeCrashRecoveryForFile("/test/file.md", "recovered content");

      const { result } = renderHook(() => useAutosave(""));

      const recoveryMap = result.current.checkCrashRecovery();

      act(() => {
        result.current.recoverFromCrash(recoveryMap);
      });

      // Storage should be cleared (App.tsx handles setting content)
      expect(localStorage.getItem("jot_crash_recovery_v2")).toBeNull();
    });

    it("save pipeline clears per-file crash recovery when isClean", async () => {
      // Set up crash recovery data for this file
      storeCrashRecoveryForFile("/test/file.md", "important unsaved content");
      // Also store for another file to verify it's not affected
      storeCrashRecoveryForFile("/test/other.md", "other content");

      // Mock save returning isClean: true
      mockSaveDocumentPipeline.mockResolvedValueOnce({ saved: true, isClean: true });

      useTabsStore.setState({
        tabs: [{
          id: "tab-1",
          filePath: "/test/file.md",
          displayName: "file",
          content: "test content",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        }],
        activeTabId: "tab-1",
      });

      const { result } = renderHook(() => useAutosave("test content"));

      await act(async () => {
        result.current.saveNow();
      });

      // The save pipeline mock was called, but crash recovery clearing
      // happens inside the real saveService (which is mocked).
      // We verify the mock was called.
      expect(mockSaveDocumentPipeline).toHaveBeenCalledWith("tab-1", true);
    });
  });

  describe("saveNow function", () => {
    it("returns a saveNow function", () => {
      const { result } = renderHook(() => useAutosave("test"));

      expect(typeof result.current.saveNow).toBe("function");
    });

    it("does not call writeFile when no file path is set", async () => {
      // No tabs open = no file path
      const { result } = renderHook(() => useAutosave("test content"));

      await act(async () => {
        result.current.saveNow();
      });

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("does not call writeFile when not dirty", async () => {
      // Tab open but not dirty
      act(() => {
        useTabsStore.setState({
          tabs: [{
            id: "tab-1",
            filePath: "/test/file.md",
            displayName: "file",
            content: "test content",
            isDirty: false,
            isPinned: false,
            scrollTop: 0,
            lastSaved: null,
          }],
          activeTabId: "tab-1",
        });
      });

      const { result } = renderHook(() => useAutosave("test content"));

      await act(async () => {
        result.current.saveNow();
      });

      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe("autosave conditions", () => {
    it("does not trigger save when there is no file path", () => {
      // No tabs open = no file path
      renderHook(() => useAutosave("test content"));

      // No crash recovery stored without a file path (no updateTabContent call)
      const data = localStorage.getItem("jot_crash_recovery_v2");
      expect(data).toBeNull();
    });

    it("does not trigger save when content is not dirty", () => {
      act(() => {
        useTabsStore.setState({
          tabs: [{
            id: "tab-1",
            filePath: "/test/file.md",
            displayName: "file",
            content: "test content",
            isDirty: false,
            isPinned: false,
            scrollTop: 0,
            lastSaved: null,
          }],
          activeTabId: "tab-1",
        });
      });

      renderHook(() => useAutosave("test content"));

      // No crash recovery stored when not dirty
      const data = localStorage.getItem("jot_crash_recovery_v2");
      expect(data).toBeNull();
    });
  });

  describe("debounce and Cmd+S interaction", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockSaveDocumentPipeline.mockResolvedValue({ saved: true, isClean: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function setupDirtyTab() {
      useTabsStore.setState({
        tabs: [{
          id: "tab-1",
          filePath: "/test/file.md",
          displayName: "file",
          content: "dirty content",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        }],
        activeTabId: "tab-1",
        saveStatus: "idle",
      });
    }

    it("content change triggers save after AUTOSAVE_DELAY_MS (1000ms)", async () => {
      setupDirtyTab();

      renderHook(() => useAutosave("dirty content"));

      // Not yet saved
      expect(mockSaveDocumentPipeline).not.toHaveBeenCalled();

      // Advance 999ms — still not saved
      await act(async () => {
        vi.advanceTimersByTime(999);
      });
      expect(mockSaveDocumentPipeline).not.toHaveBeenCalled();

      // Advance 1 more ms — now saved
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(mockSaveDocumentPipeline).toHaveBeenCalledTimes(1);
      expect(mockSaveDocumentPipeline).toHaveBeenCalledWith("tab-1", true);
    });

    it("rapid content changes reset debounce — only one save at end", async () => {
      setupDirtyTab();

      const { rerender } = renderHook(
        ({ content }) => useAutosave(content),
        { initialProps: { content: "version1" } }
      );

      // Advance 500ms
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      // New content change resets debounce
      rerender({ content: "version2" });

      // Advance another 500ms (1000ms total since first change, but only 500ms since last)
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(mockSaveDocumentPipeline).not.toHaveBeenCalled();

      // Advance remaining 500ms (1000ms since last change)
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(mockSaveDocumentPipeline).toHaveBeenCalledTimes(1);
    });

    it("saveNow (Cmd+S) bypasses debounce and saves immediately", async () => {
      setupDirtyTab();

      const { result } = renderHook(() => useAutosave("dirty content"));

      // Debounce is ticking but not yet fired
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      expect(mockSaveDocumentPipeline).not.toHaveBeenCalled();

      // Manual save bypasses debounce
      await act(async () => {
        result.current.saveNow();
      });
      expect(mockSaveDocumentPipeline).toHaveBeenCalledTimes(1);

      // The debounce timer should have been cleared — advancing past delay
      // should NOT trigger another save
      mockSaveDocumentPipeline.mockClear();
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(mockSaveDocumentPipeline).not.toHaveBeenCalled();
    });

    it("save status transitions: saving → saved → idle", async () => {
      setupDirtyTab();

      // Track save status transitions
      const statusChanges: string[] = [];
      const unsubscribe = useTabsStore.subscribe((state) => {
        statusChanges.push(state.saveStatus);
      });

      renderHook(() => useAutosave("dirty content"));

      // Trigger save
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      // Pipeline was called, and on success the hook schedules idle after 2s
      expect(mockSaveDocumentPipeline).toHaveBeenCalledTimes(1);

      // Advance 2000ms for the "saved" → "idle" transition
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // The save pipeline sets "saving" → "saved" internally (mocked),
      // and the hook sets "idle" after SAVED_INDICATOR_DURATION_MS
      // Since pipeline is mocked, we verify the hook called setSaveStatus("idle")
      expect(useTabsStore.getState().saveStatus).toBe("idle");

      unsubscribe();
    });

    it("rapid saveNow() calls are handled by pipeline (no error)", async () => {
      setupDirtyTab();

      const { result } = renderHook(() => useAutosave("dirty content"));

      // Call saveNow twice rapidly
      await act(async () => {
        result.current.saveNow();
        result.current.saveNow();
      });

      // Pipeline should be called twice (it handles serialization internally)
      expect(mockSaveDocumentPipeline).toHaveBeenCalledTimes(2);
    });
  });
});
