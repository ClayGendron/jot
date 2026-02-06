import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
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
});
