/**
 * Save Service Tests
 *
 * Tests for the unified save pipeline.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { computeSimpleHash, saveDocumentPipeline, saveAllDirtyTabs, _resetSaveQueue } from "./saveService";
import { useTabsStore } from "@/stores/tabsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useLinksStore } from "@/stores/linksStore";

// Mock dependencies
vi.mock("@/lib/tauri/files", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/tauri/versionHistory", () => ({
  saveVersion: vi.fn().mockResolvedValue(1),
}));

import { writeFile } from "@/lib/tauri/files";
import { saveVersion } from "@/lib/tauri/versionHistory";

const mockWriteFile = writeFile as Mock;
const mockSaveVersion = saveVersion as Mock;

describe("computeSimpleHash", () => {
  it("returns consistent hash for same input", () => {
    const content = "Hello, world!";
    const hash1 = computeSimpleHash(content);
    const hash2 = computeSimpleHash(content);

    expect(hash1).toBe(hash2);
  });

  it("returns different hash for different input", () => {
    const hash1 = computeSimpleHash("Hello, world!");
    const hash2 = computeSimpleHash("Goodbye, world!");

    expect(hash1).not.toBe(hash2);
  });

  it("returns hex string", () => {
    const hash = computeSimpleHash("test");
    expect(hash).toMatch(/^-?[0-9a-f]+$/);
  });

  it("handles empty string", () => {
    const hash = computeSimpleHash("");
    expect(hash).toBe("0");
  });

  it("handles unicode characters", () => {
    const hash = computeSimpleHash("Hello, 世界! 🌍");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe("saveDocumentPipeline", () => {
  beforeEach(() => {
    // Reset save queue
    _resetSaveQueue();

    // Reset all stores
    useTabsStore.setState({
      tabs: [],
      activeTabId: null,
      saveStatus: "idle",
      saveError: null,
    });

    useWorkspaceStore.setState({
      workspacePath: "/workspace",
      fileTree: [],
      isLoading: false,
      error: null,
    });

    useLinksStore.setState({
      backlinksIndex: {},
      isIndexing: false,
      lastIndexed: null,
      fileHashes: {},
    });

    // Clear mocks
    mockWriteFile.mockClear();
    mockSaveVersion.mockClear();
  });

  it("returns saved:false if tab not found", async () => {
    // Suppress expected console.warn for missing tab
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await saveDocumentPipeline("nonexistent-id", true);
    expect(result.saved).toBe(false);
    expect(result.isClean).toBe(false);
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns saved:false, isClean:true if tab is not dirty", async () => {
    // Add a clean tab
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "content",
          isDirty: false,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    const result = await saveDocumentPipeline("tab-1", true);
    expect(result.saved).toBe(false);
    expect(result.isClean).toBe(true); // Already clean
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("saves dirty tab successfully and returns isClean:true", async () => {
    // Add a dirty tab
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "Hello world",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    const result = await saveDocumentPipeline("tab-1", true);

    expect(result.saved).toBe(true);
    expect(result.isClean).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledWith("/workspace/test.md", "Hello world", "/workspace");
    expect(mockSaveVersion).toHaveBeenCalled();
  });

  it("marks tab as saved after successful save", async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "content",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    await saveDocumentPipeline("tab-1", true);

    const tab = useTabsStore.getState().tabs.find((t) => t.id === "tab-1");
    expect(tab?.isDirty).toBe(false);
  });

  it("updates file hash after save", async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "content",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    await saveDocumentPipeline("tab-1", true);

    const hashes = useLinksStore.getState().fileHashes;
    expect(hashes["/workspace/test.md"]).toBeDefined();
  });

  it("updates save status for active doc", async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "content",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    await saveDocumentPipeline("tab-1", true);

    // After successful save, status should be "saved"
    const status = useTabsStore.getState().saveStatus;
    expect(status).toBe("saved");
  });

  it("does not update save status for non-active doc", async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "content",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-2", // Different from the tab being saved
      saveStatus: "idle",
    });

    await saveDocumentPipeline("tab-1", false);

    // Status should remain idle for background save
    const status = useTabsStore.getState().saveStatus;
    expect(status).toBe("idle");
  });

  it("normalizes line endings", async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "Hello\r\nWorld",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    await saveDocumentPipeline("tab-1", true);

    // Should normalize to LF
    expect(mockWriteFile).toHaveBeenCalledWith("/workspace/test.md", "Hello\nWorld", "/workspace");
  });

  it("handles version history errors gracefully", async () => {
    // Suppress expected console.warn for version save failure
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockSaveVersion.mockRejectedValueOnce(new Error("Version save failed"));

    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "content",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    // Should not throw, version history is non-critical
    const result = await saveDocumentPipeline("tab-1", true);
    expect(result.saved).toBe(true);
    expect(result.isClean).toBe(true);
    expect(mockWriteFile).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("throws on file write error", async () => {
    // Suppress expected console.error for write failure
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockWriteFile.mockRejectedValueOnce(new Error("Write failed"));

    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "content",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    await expect(saveDocumentPipeline("tab-1", true)).rejects.toThrow("Write failed");
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("keeps isDirty true and returns isClean:false if content changed during save", async () => {
    const originalContent = "original";

    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: originalContent,
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    // Simulate content change during save by modifying tab content
    // after the pipeline starts but before it completes
    mockWriteFile.mockImplementationOnce(async () => {
      // Simulate user editing during save
      useTabsStore.setState({
        tabs: [
          {
            id: "tab-1",
            filePath: "/workspace/test.md",
            displayName: "test",
            content: "edited during save",  // Content changed!
            isDirty: true,
            isPinned: false,
            scrollTop: 0,
            lastSaved: null,
          },
        ],
        activeTabId: "tab-1",
      });
    });

    const result = await saveDocumentPipeline("tab-1", true);

    // Save succeeded but document is not clean
    expect(result.saved).toBe(true);
    expect(result.isClean).toBe(false);

    // Tab should remain dirty because content changed during save
    const tab = useTabsStore.getState().tabs.find((t) => t.id === "tab-1");
    expect(tab?.isDirty).toBe(true);
  });

  it("marks as saved only when HTML content is exactly the same", async () => {
    const content = "unchanged";

    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content,
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    const result = await saveDocumentPipeline("tab-1", true);

    // Content unchanged, should be marked as saved
    expect(result.saved).toBe(true);
    expect(result.isClean).toBe(true);
    const tab = useTabsStore.getState().tabs.find((t) => t.id === "tab-1");
    expect(tab?.isDirty).toBe(false);
  });

  it("sets SaveIndicator to idle (not saved) when content changed during save", async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "original",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    // Simulate content change during save
    mockWriteFile.mockImplementationOnce(async () => {
      useTabsStore.setState({
        tabs: [
          {
            id: "tab-1",
            filePath: "/workspace/test.md",
            displayName: "test",
            content: "edited",
            isDirty: true,
            isPinned: false,
            scrollTop: 0,
            lastSaved: null,
          },
        ],
        activeTabId: "tab-1",
      });
    });

    await saveDocumentPipeline("tab-1", true);

    // SaveIndicator should be idle, not "saved" (would be misleading)
    const status = useTabsStore.getState().saveStatus;
    expect(status).toBe("idle");
  });
});

describe("per-file save mutex", () => {
  beforeEach(() => {
    _resetSaveQueue();

    useTabsStore.setState({
      tabs: [],
      activeTabId: null,
      saveStatus: "idle",
      saveError: null,
    });

    useWorkspaceStore.setState({
      workspacePath: "/workspace",
      fileTree: [],
      isLoading: false,
      error: null,
    });

    useLinksStore.setState({
      backlinksIndex: {},
      isIndexing: false,
      lastIndexed: null,
      fileHashes: {},
    });

    mockWriteFile.mockClear();
    mockWriteFile.mockResolvedValue(undefined);
    mockSaveVersion.mockClear();
    mockSaveVersion.mockResolvedValue(1);
  });

  it("serializes concurrent saves for the same file", async () => {
    const writeOrder: number[] = [];

    // First write takes 50ms
    mockWriteFile.mockImplementationOnce(async () => {
      writeOrder.push(1);
      await new Promise((r) => setTimeout(r, 50));
    });
    // Second write is fast
    mockWriteFile.mockImplementationOnce(async () => {
      writeOrder.push(2);
    });

    useTabsStore.setState({
      tabs: [{
        id: "tab-1",
        filePath: "/workspace/test.md",
        displayName: "test",
        content: "version 1",
        isDirty: true,
        isPinned: false,
        scrollTop: 0,
        lastSaved: null,
      }],
      activeTabId: "tab-1",
    });

    // Launch two saves concurrently
    const save1 = saveDocumentPipeline("tab-1", false);

    // Make tab dirty again for second save
    useTabsStore.setState({
      tabs: [{
        id: "tab-1",
        filePath: "/workspace/test.md",
        displayName: "test",
        content: "version 2",
        isDirty: true,
        isPinned: false,
        scrollTop: 0,
        lastSaved: null,
      }],
    });

    const save2 = saveDocumentPipeline("tab-1", false);

    await Promise.all([save1, save2]);

    // First write should complete before second starts
    expect(writeOrder).toEqual([1, 2]);
  });

  it("allows concurrent saves for different files", async () => {
    const writeOrder: string[] = [];

    mockWriteFile.mockImplementation(async (path: string) => {
      writeOrder.push(path);
      await new Promise((r) => setTimeout(r, 10));
    });

    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/a.md",
          displayName: "a",
          content: "A",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
        {
          id: "tab-2",
          filePath: "/workspace/b.md",
          displayName: "b",
          content: "B",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    // Both should start immediately (different files = no queueing)
    const [r1, r2] = await Promise.all([
      saveDocumentPipeline("tab-1", false),
      saveDocumentPipeline("tab-2", false),
    ]);

    expect(r1.saved).toBe(true);
    expect(r2.saved).toBe(true);
    // Both writes should have happened
    expect(writeOrder).toContain("/workspace/a.md");
    expect(writeOrder).toContain("/workspace/b.md");
  });

  it("second caller no-ops if first save made file clean", async () => {
    mockWriteFile.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });

    useTabsStore.setState({
      tabs: [{
        id: "tab-1",
        filePath: "/workspace/test.md",
        displayName: "test",
        content: "content",
        isDirty: true,
        isPinned: false,
        scrollTop: 0,
        lastSaved: null,
      }],
      activeTabId: "tab-1",
    });

    const save1 = saveDocumentPipeline("tab-1", false);
    const save2 = saveDocumentPipeline("tab-1", false);

    const [r1, r2] = await Promise.all([save1, save2]);

    // First save succeeds
    expect(r1.saved).toBe(true);
    expect(r1.isClean).toBe(true);
    // Second caller skips because tab is now clean
    expect(r2.saved).toBe(false);
    expect(r2.isClean).toBe(true);
    // writeFile only called once
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });

  it("second caller re-saves if content changed during first save", async () => {
    mockWriteFile.mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 30));
      // Simulate user editing during save — content changes, tab stays dirty
      useTabsStore.setState({
        tabs: [{
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "edited during save",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        }],
      });
    });
    mockWriteFile.mockImplementationOnce(async () => {
      // Second write succeeds
    });

    useTabsStore.setState({
      tabs: [{
        id: "tab-1",
        filePath: "/workspace/test.md",
        displayName: "test",
        content: "original",
        isDirty: true,
        isPinned: false,
        scrollTop: 0,
        lastSaved: null,
      }],
      activeTabId: "tab-1",
    });

    const save1 = saveDocumentPipeline("tab-1", false);
    const save2 = saveDocumentPipeline("tab-1", false);

    const [r1, r2] = await Promise.all([save1, save2]);

    // First save wrote but content changed, so not clean
    expect(r1.saved).toBe(true);
    expect(r1.isClean).toBe(false);
    // Second caller sees dirty tab, saves again
    expect(r2.saved).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
  });

  it("handles first save failure — second caller still attempts", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockWriteFile
      .mockRejectedValueOnce(new Error("Disk full"))
      .mockResolvedValueOnce(undefined);

    useTabsStore.setState({
      tabs: [{
        id: "tab-1",
        filePath: "/workspace/test.md",
        displayName: "test",
        content: "content",
        isDirty: true,
        isPinned: false,
        scrollTop: 0,
        lastSaved: null,
      }],
      activeTabId: "tab-1",
    });

    const save1 = saveDocumentPipeline("tab-1", false);
    const save2 = saveDocumentPipeline("tab-1", false);

    const results = await Promise.allSettled([save1, save2]);

    // First save fails
    expect(results[0].status).toBe("rejected");
    // Second save succeeds
    expect(results[1].status).toBe("fulfilled");
    if (results[1].status === "fulfilled") {
      expect(results[1].value.saved).toBe(true);
    }

    errorSpy.mockRestore();
  });

  it("cleans up queue entry after save completes", async () => {
    useTabsStore.setState({
      tabs: [{
        id: "tab-1",
        filePath: "/workspace/test.md",
        displayName: "test",
        content: "content",
        isDirty: true,
        isPinned: false,
        scrollTop: 0,
        lastSaved: null,
      }],
      activeTabId: "tab-1",
    });

    await saveDocumentPipeline("tab-1", false);

    // After completion, a new save for the same file should not hit the queue path
    // (it should go directly to executeSave). We verify by checking writeFile is called again.
    useTabsStore.setState({
      tabs: [{
        id: "tab-1",
        filePath: "/workspace/test.md",
        displayName: "test",
        content: "new content",
        isDirty: true,
        isPinned: false,
        scrollTop: 0,
        lastSaved: null,
      }],
    });

    await saveDocumentPipeline("tab-1", false);
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
  });
});

describe("saveAllDirtyTabs", () => {
  beforeEach(() => {
    _resetSaveQueue();

    useTabsStore.setState({
      tabs: [],
      activeTabId: null,
      saveStatus: "idle",
      saveError: null,
    });

    useWorkspaceStore.setState({
      workspacePath: "/workspace",
      fileTree: [],
      isLoading: false,
      error: null,
    });

    useLinksStore.setState({
      backlinksIndex: {},
      isIndexing: false,
      lastIndexed: null,
      fileHashes: {},
    });

    mockWriteFile.mockClear();
    mockWriteFile.mockResolvedValue(undefined);
    mockSaveVersion.mockClear();
    mockSaveVersion.mockResolvedValue(1);
  });

  it("returns empty array when no dirty tabs", async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "content",
          isDirty: false,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    const failed = await saveAllDirtyTabs("tab-1");
    expect(failed).toEqual([]);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("saves all dirty tabs", async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/a.md",
          displayName: "a",
          content: "A",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
        {
          id: "tab-2",
          filePath: "/workspace/b.md",
          displayName: "b",
          content: "B",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
        {
          id: "tab-3",
          filePath: "/workspace/c.md",
          displayName: "c",
          content: "C",
          isDirty: false,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    const failed = await saveAllDirtyTabs("tab-1");

    expect(failed).toEqual([]);
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
  });

  it("returns IDs of tabs that failed to save", async () => {
    // Suppress expected console.error for save failure
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockWriteFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Failed"));

    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/a.md",
          displayName: "a",
          content: "A",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
        {
          id: "tab-2",
          filePath: "/workspace/b.md",
          displayName: "b",
          content: "B",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
          lastSaved: null,
        },
      ],
      activeTabId: "tab-1",
    });

    const failed = await saveAllDirtyTabs("tab-1");

    expect(failed).toEqual(["tab-2"]);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
