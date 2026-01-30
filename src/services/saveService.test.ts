/**
 * Save Service Tests
 *
 * Tests for the unified save pipeline.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { computeSimpleHash, saveDocumentPipeline, saveAllDirtyTabs } from "./saveService";
import { useTabsStore } from "@/stores/tabsStore";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useLinksStore } from "@/stores/linksStore";

// Mock dependencies
vi.mock("@/lib/tauri/files", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/tauri/versionHistory", () => ({
  saveVersion: vi.fn().mockResolvedValue(1),
}));

vi.mock("@/lib/markdown/htmlToMarkdown", () => ({
  htmlToMarkdown: vi.fn((html: string) => {
    // Simple mock: strip HTML tags
    return html.replace(/<[^>]+>/g, "");
  }),
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
    // Reset all stores
    useTabsStore.setState({
      tabs: [],
      activeTabId: null,
      saveStatus: "idle",
      saveError: null,
    });

    useEditorStore.setState({
      filePath: null,
      content: "",
      isDirty: false,
      lastSaved: null,
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

  it("returns false if tab not found", async () => {
    const result = await saveDocumentPipeline("nonexistent-id", true);
    expect(result).toBe(false);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("returns false if tab is not dirty", async () => {
    // Add a clean tab
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "<p>content</p>",
          isDirty: false,
          isPinned: false,
          scrollTop: 0,
        },
      ],
      activeTabId: "tab-1",
    });

    const result = await saveDocumentPipeline("tab-1", true);
    expect(result).toBe(false);
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it("saves dirty tab successfully", async () => {
    // Add a dirty tab
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "<p>Hello world</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
        },
      ],
      activeTabId: "tab-1",
    });

    const result = await saveDocumentPipeline("tab-1", true);

    expect(result).toBe(true);
    expect(mockWriteFile).toHaveBeenCalledWith("/workspace/test.md", "Hello world");
    expect(mockSaveVersion).toHaveBeenCalled();
  });

  it("marks tab as saved after successful save", async () => {
    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "<p>content</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
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
          content: "<p>content</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
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
          content: "<p>content</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
        },
      ],
      activeTabId: "tab-1",
    });

    await saveDocumentPipeline("tab-1", true);

    // After successful save, status should be "saved"
    const status = useEditorStore.getState().saveStatus;
    expect(status).toBe("saved");
  });

  it("does not update save status for non-active doc", async () => {
    useEditorStore.setState({ saveStatus: "idle" });

    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "<p>content</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
        },
      ],
      activeTabId: "tab-2", // Different from the tab being saved
    });

    await saveDocumentPipeline("tab-1", false);

    // Status should remain idle for background save
    const status = useEditorStore.getState().saveStatus;
    expect(status).toBe("idle");
  });

  it("normalizes line endings", async () => {
    // Mock htmlToMarkdown to return content with CRLF
    const { htmlToMarkdown } = await import("@/lib/markdown/htmlToMarkdown");
    (htmlToMarkdown as Mock).mockReturnValueOnce("Hello\r\nWorld");

    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "<p>content</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
        },
      ],
      activeTabId: "tab-1",
    });

    await saveDocumentPipeline("tab-1", true);

    // Should normalize to LF
    expect(mockWriteFile).toHaveBeenCalledWith("/workspace/test.md", "Hello\nWorld");
  });

  it("handles version history errors gracefully", async () => {
    mockSaveVersion.mockRejectedValueOnce(new Error("Version save failed"));

    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "<p>content</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
        },
      ],
      activeTabId: "tab-1",
    });

    // Should not throw, version history is non-critical
    const result = await saveDocumentPipeline("tab-1", true);
    expect(result).toBe(true);
    expect(mockWriteFile).toHaveBeenCalled();
  });

  it("throws on file write error", async () => {
    mockWriteFile.mockRejectedValueOnce(new Error("Write failed"));

    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/test.md",
          displayName: "test",
          content: "<p>content</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
        },
      ],
      activeTabId: "tab-1",
    });

    await expect(saveDocumentPipeline("tab-1", true)).rejects.toThrow("Write failed");
  });
});

describe("saveAllDirtyTabs", () => {
  beforeEach(() => {
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
          content: "<p>content</p>",
          isDirty: false,
          isPinned: false,
          scrollTop: 0,
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
          content: "<p>A</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
        },
        {
          id: "tab-2",
          filePath: "/workspace/b.md",
          displayName: "b",
          content: "<p>B</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
        },
        {
          id: "tab-3",
          filePath: "/workspace/c.md",
          displayName: "c",
          content: "<p>C</p>",
          isDirty: false,
          isPinned: false,
          scrollTop: 0,
        },
      ],
      activeTabId: "tab-1",
    });

    const failed = await saveAllDirtyTabs("tab-1");

    expect(failed).toEqual([]);
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
  });

  it("returns IDs of tabs that failed to save", async () => {
    mockWriteFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Failed"));

    useTabsStore.setState({
      tabs: [
        {
          id: "tab-1",
          filePath: "/workspace/a.md",
          displayName: "a",
          content: "<p>A</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
        },
        {
          id: "tab-2",
          filePath: "/workspace/b.md",
          displayName: "b",
          content: "<p>B</p>",
          isDirty: true,
          isPinned: false,
          scrollTop: 0,
        },
      ],
      activeTabId: "tab-1",
    });

    const failed = await saveAllDirtyTabs("tab-1");

    expect(failed).toEqual(["tab-2"]);
  });
});
