import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutosave } from "./useAutosave";
import { useEditorStore } from "@/stores/editorStore";
import { useTabsStore } from "@/stores/tabsStore";

// Mock the tauri files module
vi.mock("@/lib/tauri/files", () => ({
  writeFile: vi.fn(),
}));

// Mock the save service
vi.mock("@/services/saveService", () => ({
  saveDocumentPipeline: vi.fn().mockResolvedValue(true),
}));

import { writeFile } from "@/lib/tauri/files";
import { saveDocumentPipeline } from "@/services/saveService";

const mockWriteFile = writeFile as Mock;
const mockSaveDocumentPipeline = saveDocumentPipeline as Mock;

describe("useAutosave", () => {
  beforeEach(() => {
    // Reset the editor store
    useEditorStore.setState({
      filePath: null,
      content: "",
      isDirty: false,
      lastSaved: null,
      saveStatus: "idle",
      saveError: null,
      sidebarOpen: true,
      focusMode: false,
      theme: "system",
      sourceMode: false,
    });
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
    it("stores content in localStorage for crash recovery when dirty", () => {
      const content = "test content for recovery";

      // Set up a tab with the content
      useTabsStore.setState({
        tabs: [{
          id: "tab-1",
          filePath: "/test/file.md",
          displayName: "file",
          content: content,
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
        }],
        activeTabId: "tab-1",
      });

      renderHook(() => useAutosave(content));

      // Set dirty with file path - this triggers crash recovery storage
      act(() => {
        useEditorStore.setState({
          filePath: "/test/file.md",
          isDirty: true,
          content: content,
        });
      });

      // Content should be stored immediately
      const storedData = localStorage.getItem("jot_crash_recovery");
      expect(storedData).not.toBeNull();

      const parsed = JSON.parse(storedData!);
      expect(parsed.filePath).toBe("/test/file.md");
      expect(parsed.content).toBe(content);
      expect(parsed.timestamp).toBeDefined();
    });

    it("checkCrashRecovery returns stored data within 24h", () => {
      const recoveryData = {
        filePath: "/test/recovered.md",
        content: "recovered content",
        timestamp: Date.now(),
      };
      localStorage.setItem("jot_crash_recovery", JSON.stringify(recoveryData));

      const { result } = renderHook(() => useAutosave(""));

      const recovered = result.current.checkCrashRecovery();
      expect(recovered).not.toBeNull();
      expect(recovered?.content).toBe("recovered content");
      expect(recovered?.filePath).toBe("/test/recovered.md");
    });

    it("checkCrashRecovery returns null for stale data (>24h)", () => {
      const staleData = {
        filePath: "/test/old.md",
        content: "old content",
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      };
      localStorage.setItem("jot_crash_recovery", JSON.stringify(staleData));

      const { result } = renderHook(() => useAutosave(""));

      const recovered = result.current.checkCrashRecovery();
      expect(recovered).toBeNull();

      // Should have cleared the stale data
      expect(localStorage.getItem("jot_crash_recovery")).toBeNull();
    });

    it("checkCrashRecovery returns null when no data exists", () => {
      const { result } = renderHook(() => useAutosave(""));

      const recovered = result.current.checkCrashRecovery();
      expect(recovered).toBeNull();
    });

    it("checkCrashRecovery handles invalid JSON gracefully", () => {
      localStorage.setItem("jot_crash_recovery", "not valid json");

      const { result } = renderHook(() => useAutosave(""));

      const recovered = result.current.checkCrashRecovery();
      expect(recovered).toBeNull();

      // Should have cleared the invalid data
      expect(localStorage.getItem("jot_crash_recovery")).toBeNull();
    });

    it("recoverFromCrash updates content and clears storage", () => {
      const recoveryData = {
        filePath: "/test/file.md",
        content: "recovered content",
        timestamp: Date.now(),
      };
      localStorage.setItem("jot_crash_recovery", JSON.stringify(recoveryData));

      const { result } = renderHook(() => useAutosave(""));

      act(() => {
        result.current.recoverFromCrash(recoveryData);
      });

      // Content should be set in store
      expect(useEditorStore.getState().content).toBe("recovered content");

      // Storage should be cleared
      expect(localStorage.getItem("jot_crash_recovery")).toBeNull();
    });
  });

  describe("saveNow function", () => {
    it("returns a saveNow function", () => {
      const { result } = renderHook(() => useAutosave("test"));

      expect(typeof result.current.saveNow).toBe("function");
    });

    it("does not call writeFile when no file path is set", async () => {
      const { result } = renderHook(() => useAutosave("test content"));

      // No file path set
      act(() => {
        useEditorStore.setState({ isDirty: true, filePath: null });
      });

      await act(async () => {
        result.current.saveNow();
      });

      expect(mockWriteFile).not.toHaveBeenCalled();
    });

    it("does not call writeFile when not dirty", async () => {
      const { result } = renderHook(() => useAutosave("test content"));

      // File path set but not dirty
      act(() => {
        useEditorStore.setState({
          isDirty: false,
          filePath: "/test/file.md",
        });
      });

      await act(async () => {
        result.current.saveNow();
      });

      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe("autosave conditions", () => {
    it("does not trigger save when there is no file path", () => {
      renderHook(() => useAutosave("test content"));

      act(() => {
        useEditorStore.setState({ isDirty: true, filePath: null });
      });

      // No storage should happen without file path
      const storedData = localStorage.getItem("jot_crash_recovery");
      expect(storedData).toBeNull();
    });

    it("does not trigger save when content is not dirty", () => {
      renderHook(() => useAutosave("test content"));

      act(() => {
        useEditorStore.setState({
          filePath: "/test/file.md",
          isDirty: false,
        });
      });

      // No storage when not dirty
      const storedData = localStorage.getItem("jot_crash_recovery");
      expect(storedData).toBeNull();
    });
  });
});
