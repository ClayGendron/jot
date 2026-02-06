/**
 * Cross-Store Integration Tests
 *
 * Tests interactions between tabsStore, workspaceStore, and saveService
 * to verify that the stores work together correctly as a system.
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { useTabsStore } from "@/stores/tabsStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useLinksStore } from "@/stores/linksStore";
import { readCrashRecoveryData } from "@/lib/crashRecovery";

// Mock tauri files (writeFile) and version history
vi.mock("@/lib/tauri/files", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/tauri/versionHistory", () => ({
  saveVersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/semanticIndexingService", () => ({
  queueFileForIndexing: vi.fn(),
}));

// Import saveService AFTER mocks are set up
import { saveDocumentPipeline, _resetSaveQueue } from "@/services/saveService";
import { writeFile } from "@/lib/tauri/files";

const mockWriteFile = writeFile as Mock;

describe("Cross-store integration", () => {
  beforeEach(() => {
    // Reset all stores
    useTabsStore.setState({
      tabs: [],
      activeTabId: null,
      saveStatus: "idle",
      saveError: null,
    });
    useWorkspaceStore.setState({
      workspacePath: "/workspace",
      isCaseSensitiveFs: false,
    });
    useLinksStore.getState().setFileHash("", ""); // init
    localStorage.clear();
    mockWriteFile.mockClear();
    _resetSaveQueue();
  });

  describe("saveDocumentPipeline ↔ tabsStore", () => {
    it("reads content from tabsStore and marks tab saved on success", async () => {
      // Arrange: open a dirty tab
      const tabId = useTabsStore.getState().openTab("/workspace/doc.md", "initial");
      useTabsStore.getState().updateTabContent(tabId, "updated content");

      const tab = useTabsStore.getState().tabs.find(t => t.id === tabId)!;
      expect(tab.isDirty).toBe(true);
      expect(tab.content).toBe("updated content");

      // Act: save via pipeline
      const result = await saveDocumentPipeline(tabId, true);

      // Assert: save succeeded
      expect(result.saved).toBe(true);
      expect(result.isClean).toBe(true);

      // Tab should now be clean
      const savedTab = useTabsStore.getState().tabs.find(t => t.id === tabId)!;
      expect(savedTab.isDirty).toBe(false);
      expect(savedTab.lastSaved).toBeInstanceOf(Date);

      // writeFile should have been called with the content
      expect(mockWriteFile).toHaveBeenCalledWith(
        "/workspace/doc.md",
        "updated content",
        "/workspace"
      );
    });

    it("sets saveStatus to 'saving' then 'saved' for active document", async () => {
      const tabId = useTabsStore.getState().openTab("/workspace/doc.md", "content");
      useTabsStore.getState().updateTabContent(tabId, "dirty");

      const statuses: string[] = [];
      const unsub = useTabsStore.subscribe((s) => statuses.push(s.saveStatus));

      await saveDocumentPipeline(tabId, true);

      unsub();

      // Should have transitioned through "saving" and "saved"
      expect(statuses).toContain("saving");
      expect(statuses).toContain("saved");
    });

    it("does not set saveStatus for non-active documents (isActiveDoc=false)", async () => {
      const tabId = useTabsStore.getState().openTab("/workspace/doc.md", "content");
      useTabsStore.getState().updateTabContent(tabId, "dirty");

      await saveDocumentPipeline(tabId, false);

      // saveStatus should remain idle (pipeline doesn't update it for non-active docs)
      expect(useTabsStore.getState().saveStatus).toBe("idle");
    });

    it("returns isClean:true when no other edits during save", async () => {
      const tabId = useTabsStore.getState().openTab("/workspace/doc.md", "content");
      useTabsStore.getState().updateTabContent(tabId, "dirty content");

      const result = await saveDocumentPipeline(tabId, false);

      expect(result.saved).toBe(true);
      expect(result.isClean).toBe(true);
    });

    it("skips save when tab is not dirty", async () => {
      const tabId = useTabsStore.getState().openTab("/workspace/doc.md", "clean content");
      // Tab is not dirty

      const result = await saveDocumentPipeline(tabId, true);

      expect(result.saved).toBe(false);
      expect(result.isClean).toBe(true);
      expect(mockWriteFile).not.toHaveBeenCalled();
    });
  });

  describe("updateTabContent ↔ crash recovery", () => {
    it("updateTabContent writes crash recovery to localStorage", () => {
      const tabId = useTabsStore.getState().openTab("/workspace/doc.md", "initial");

      useTabsStore.getState().updateTabContent(tabId, "unsaved edits");

      const recovered = readCrashRecoveryData();
      expect(recovered["/workspace/doc.md"]).toBeDefined();
      expect(recovered["/workspace/doc.md"].content).toBe("unsaved edits");
    });

    it("each updateTabContent overwrites the crash recovery entry", () => {
      const tabId = useTabsStore.getState().openTab("/workspace/doc.md", "initial");

      useTabsStore.getState().updateTabContent(tabId, "version 1");
      useTabsStore.getState().updateTabContent(tabId, "version 2");

      const recovered = readCrashRecoveryData();
      expect(recovered["/workspace/doc.md"].content).toBe("version 2");
    });

    it("crash recovery stores data per-file independently", () => {
      const tab1 = useTabsStore.getState().openTab("/workspace/a.md", "initial a");
      const tab2 = useTabsStore.getState().openTab("/workspace/b.md", "initial b");

      useTabsStore.getState().updateTabContent(tab1, "dirty a");
      useTabsStore.getState().updateTabContent(tab2, "dirty b");

      const recovered = readCrashRecoveryData();
      expect(Object.keys(recovered)).toHaveLength(2);
      expect(recovered["/workspace/a.md"].content).toBe("dirty a");
      expect(recovered["/workspace/b.md"].content).toBe("dirty b");
    });

    it("save pipeline clears crash recovery for saved file", async () => {
      const tab1 = useTabsStore.getState().openTab("/workspace/a.md", "initial a");
      const tab2 = useTabsStore.getState().openTab("/workspace/b.md", "initial b");

      useTabsStore.getState().updateTabContent(tab1, "dirty a");
      useTabsStore.getState().updateTabContent(tab2, "dirty b");

      // Save only tab1
      await saveDocumentPipeline(tab1, false);

      const recovered = readCrashRecoveryData();
      // a.md should be cleared, b.md should remain
      expect(recovered["/workspace/a.md"]).toBeUndefined();
      expect(recovered["/workspace/b.md"]).toBeDefined();
      expect(recovered["/workspace/b.md"].content).toBe("dirty b");
    });
  });

  describe("workspaceStore.isCaseSensitiveFs ↔ tabsStore.findTabByPath", () => {
    it("case-insensitive: findTabByPath matches different-cased path", () => {
      useWorkspaceStore.setState({ isCaseSensitiveFs: false });

      useTabsStore.getState().openTab("/workspace/Notes.md", "content");

      const found = useTabsStore.getState().findTabByPath("/workspace/notes.md");
      expect(found).toBeDefined();
      expect(found?.filePath).toBe("/workspace/Notes.md");
    });

    it("case-sensitive: findTabByPath does NOT match different-cased path", () => {
      useWorkspaceStore.setState({ isCaseSensitiveFs: true });

      useTabsStore.getState().openTab("/workspace/Notes.md", "content");

      const found = useTabsStore.getState().findTabByPath("/workspace/notes.md");
      expect(found).toBeUndefined();
    });

    it("case-insensitive: openTab deduplicates different-cased paths", () => {
      useWorkspaceStore.setState({ isCaseSensitiveFs: false });

      const id1 = useTabsStore.getState().openTab("/workspace/Doc.md", "content");
      const id2 = useTabsStore.getState().openTab("/workspace/doc.md", "different");

      expect(id1).toBe(id2);
      expect(useTabsStore.getState().tabs).toHaveLength(1);
    });

    it("case-sensitive: openTab creates separate tabs for different-cased paths", () => {
      useWorkspaceStore.setState({ isCaseSensitiveFs: true });

      useTabsStore.getState().openTab("/workspace/Doc.md", "content 1");
      useTabsStore.getState().openTab("/workspace/doc.md", "content 2");

      expect(useTabsStore.getState().tabs).toHaveLength(2);
    });
  });
});
