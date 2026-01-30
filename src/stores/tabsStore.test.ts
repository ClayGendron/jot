import { describe, it, expect, beforeEach } from "vitest";
import {
  useTabsStore,
  selectActiveTab,
  selectHasUnsavedChanges,
} from "./tabsStore";

describe("tabsStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useTabsStore.setState({
      tabs: [],
      activeTabId: null,
      saveStatus: "idle",
      saveError: null,
    });
  });

  describe("Initial State", () => {
    it("initializes with empty tabs", () => {
      const state = useTabsStore.getState();

      expect(state.tabs).toEqual([]);
      expect(state.activeTabId).toBeNull();
      expect(state.saveStatus).toBe("idle");
      expect(state.saveError).toBeNull();
    });
  });

  describe("openTab", () => {
    it("opens a new tab and sets it as active", () => {
      const { openTab } = useTabsStore.getState();

      const tabId = openTab("/path/to/document.md", "<p>Content</p>");

      const state = useTabsStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(tabId);
      expect(state.tabs[0].filePath).toBe("/path/to/document.md");
      expect(state.tabs[0].displayName).toBe("document");
      expect(state.tabs[0].content).toBe("<p>Content</p>");
      expect(state.tabs[0].isDirty).toBe(false);
      expect(state.tabs[0].isPinned).toBe(false);
      expect(state.activeTabId).toBe(tabId);
    });

    it("extracts display name without .md extension", () => {
      const { openTab } = useTabsStore.getState();

      openTab("/path/to/my-notes.md", "");

      const state = useTabsStore.getState();
      expect(state.tabs[0].displayName).toBe("my-notes");
    });

    it("returns existing tab ID if file is already open", () => {
      const { openTab } = useTabsStore.getState();

      const firstId = openTab("/path/to/doc.md", "<p>Original</p>");
      const secondId = openTab("/path/to/doc.md", "<p>New content</p>");

      expect(secondId).toBe(firstId);
      const state = useTabsStore.getState();
      expect(state.tabs).toHaveLength(1);
      // Content should NOT be updated when switching to existing tab
      expect(state.tabs[0].content).toBe("<p>Original</p>");
    });

    it("opens multiple tabs", () => {
      const { openTab } = useTabsStore.getState();

      openTab("/path/to/doc1.md", "content1");
      openTab("/path/to/doc2.md", "content2");
      openTab("/path/to/doc3.md", "content3");

      const state = useTabsStore.getState();
      expect(state.tabs).toHaveLength(3);
      // Last opened tab should be active
      expect(state.tabs.find((t) => t.id === state.activeTabId)?.displayName).toBe("doc3");
    });
  });

  describe("closeTab", () => {
    it("closes a tab and returns next active tab ID", () => {
      const { openTab, closeTab } = useTabsStore.getState();

      const tab1Id = openTab("/path/to/doc1.md", "content1");
      const tab2Id = openTab("/path/to/doc2.md", "content2");

      const nextTabId = closeTab(tab2Id);

      const state = useTabsStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(tab1Id);
      expect(nextTabId).toBe(tab1Id);
      expect(state.activeTabId).toBe(tab1Id);
    });

    it("switches to adjacent tab when closing active tab", () => {
      const { openTab, closeTab, setActiveTab } = useTabsStore.getState();

      openTab("/path/to/doc1.md", "content1");
      const tab2Id = openTab("/path/to/doc2.md", "content2");
      const tab3Id = openTab("/path/to/doc3.md", "content3");

      // Make tab2 active
      setActiveTab(tab2Id);

      // Close tab2 - should switch to tab3 (right neighbor)
      const nextTabId = closeTab(tab2Id);

      expect(nextTabId).toBe(tab3Id);
      expect(useTabsStore.getState().activeTabId).toBe(tab3Id);
    });

    it("switches to left tab when closing rightmost tab", () => {
      const { openTab, closeTab } = useTabsStore.getState();

      const tab1Id = openTab("/path/to/doc1.md", "content1");
      openTab("/path/to/doc2.md", "content2");
      const tab3Id = openTab("/path/to/doc3.md", "content3");

      // Tab3 is active (last opened)
      const nextTabId = closeTab(tab3Id);

      // Should switch to tab2 (now rightmost)
      const state = useTabsStore.getState();
      expect(state.tabs).toHaveLength(2);
      expect(nextTabId).not.toBe(tab1Id); // tab2, not tab1
    });

    it("returns null when closing the last tab", () => {
      const { openTab, closeTab } = useTabsStore.getState();

      const tabId = openTab("/path/to/doc.md", "content");
      const nextTabId = closeTab(tabId);

      expect(nextTabId).toBeNull();
      expect(useTabsStore.getState().tabs).toHaveLength(0);
      expect(useTabsStore.getState().activeTabId).toBeNull();
    });

    it("does nothing for non-existent tab", () => {
      const { openTab, closeTab } = useTabsStore.getState();

      openTab("/path/to/doc.md", "content");
      const result = closeTab("non-existent-id");

      expect(result).toBeNull();
      expect(useTabsStore.getState().tabs).toHaveLength(1);
    });
  });

  describe("closeOtherTabs", () => {
    it("closes all tabs except the specified one", () => {
      const { openTab, closeOtherTabs } = useTabsStore.getState();

      openTab("/path/to/doc1.md", "content1");
      const tab2Id = openTab("/path/to/doc2.md", "content2");
      openTab("/path/to/doc3.md", "content3");

      closeOtherTabs(tab2Id);

      const state = useTabsStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(tab2Id);
      expect(state.activeTabId).toBe(tab2Id);
    });

    it("keeps pinned tabs when closing others", () => {
      const { openTab, closeOtherTabs, togglePinTab } = useTabsStore.getState();

      const tab1Id = openTab("/path/to/doc1.md", "content1");
      const tab2Id = openTab("/path/to/doc2.md", "content2");
      openTab("/path/to/doc3.md", "content3");

      togglePinTab(tab1Id); // Pin tab1

      closeOtherTabs(tab2Id);

      const state = useTabsStore.getState();
      expect(state.tabs).toHaveLength(2);
      expect(state.tabs.map((t) => t.id)).toContain(tab1Id);
      expect(state.tabs.map((t) => t.id)).toContain(tab2Id);
    });
  });

  describe("closeAllTabs", () => {
    it("closes all unpinned tabs", () => {
      const { openTab, closeAllTabs } = useTabsStore.getState();

      openTab("/path/to/doc1.md", "content1");
      openTab("/path/to/doc2.md", "content2");

      closeAllTabs();

      const state = useTabsStore.getState();
      expect(state.tabs).toHaveLength(0);
      expect(state.activeTabId).toBeNull();
    });

    it("keeps pinned tabs when closing all", () => {
      const { openTab, closeAllTabs, togglePinTab } = useTabsStore.getState();

      const tab1Id = openTab("/path/to/doc1.md", "content1");
      openTab("/path/to/doc2.md", "content2");

      togglePinTab(tab1Id);

      closeAllTabs();

      const state = useTabsStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].id).toBe(tab1Id);
      expect(state.activeTabId).toBe(tab1Id);
    });
  });

  describe("setActiveTab", () => {
    it("sets the active tab", () => {
      const { openTab, setActiveTab } = useTabsStore.getState();

      const tab1Id = openTab("/path/to/doc1.md", "content1");
      openTab("/path/to/doc2.md", "content2");

      setActiveTab(tab1Id);

      expect(useTabsStore.getState().activeTabId).toBe(tab1Id);
    });

    it("does nothing for non-existent tab", () => {
      const { openTab, setActiveTab } = useTabsStore.getState();

      const tabId = openTab("/path/to/doc.md", "content");
      setActiveTab("non-existent-id");

      expect(useTabsStore.getState().activeTabId).toBe(tabId);
    });
  });

  describe("updateTabContent", () => {
    it("updates content and marks tab as dirty", () => {
      const { openTab, updateTabContent } = useTabsStore.getState();

      const tabId = openTab("/path/to/doc.md", "<p>Original</p>");
      updateTabContent(tabId, "<p>Updated</p>");

      const state = useTabsStore.getState();
      expect(state.tabs[0].content).toBe("<p>Updated</p>");
      expect(state.tabs[0].isDirty).toBe(true);
    });
  });

  describe("markTabDirty / markTabSaved", () => {
    it("markTabDirty sets isDirty to true", () => {
      const { openTab, markTabDirty } = useTabsStore.getState();

      const tabId = openTab("/path/to/doc.md", "content");
      expect(useTabsStore.getState().tabs[0].isDirty).toBe(false);

      markTabDirty(tabId);
      expect(useTabsStore.getState().tabs[0].isDirty).toBe(true);
    });

    it("markTabSaved sets isDirty to false", () => {
      const { openTab, markTabDirty, markTabSaved } = useTabsStore.getState();

      const tabId = openTab("/path/to/doc.md", "content");
      markTabDirty(tabId);
      expect(useTabsStore.getState().tabs[0].isDirty).toBe(true);

      markTabSaved(tabId);
      expect(useTabsStore.getState().tabs[0].isDirty).toBe(false);
    });
  });

  describe("togglePinTab", () => {
    it("toggles pin state", () => {
      const { openTab, togglePinTab } = useTabsStore.getState();

      const tabId = openTab("/path/to/doc.md", "content");
      expect(useTabsStore.getState().tabs[0].isPinned).toBe(false);

      togglePinTab(tabId);
      expect(useTabsStore.getState().tabs[0].isPinned).toBe(true);

      togglePinTab(tabId);
      expect(useTabsStore.getState().tabs[0].isPinned).toBe(false);
    });

    it("moves pinned tabs to the front", () => {
      const { openTab, togglePinTab } = useTabsStore.getState();

      openTab("/path/to/doc1.md", "content1");
      openTab("/path/to/doc2.md", "content2");
      const tab3Id = openTab("/path/to/doc3.md", "content3");

      togglePinTab(tab3Id);

      const state = useTabsStore.getState();
      expect(state.tabs[0].id).toBe(tab3Id);
      expect(state.tabs[0].isPinned).toBe(true);
    });
  });

  describe("reorderTab", () => {
    it("reorders tabs within unpinned section", () => {
      const { openTab, reorderTab } = useTabsStore.getState();

      openTab("/path/to/doc1.md", "content1");
      openTab("/path/to/doc2.md", "content2");
      openTab("/path/to/doc3.md", "content3");

      // Move doc3 (index 2) to index 0
      reorderTab(2, 0);

      const state = useTabsStore.getState();
      expect(state.tabs[0].displayName).toBe("doc3");
      expect(state.tabs[1].displayName).toBe("doc1");
      expect(state.tabs[2].displayName).toBe("doc2");
    });

    it("keeps pinned tabs in pinned section during reorder", () => {
      const { openTab, togglePinTab, reorderTab } = useTabsStore.getState();

      const tab1Id = openTab("/path/to/doc1.md", "content1");
      openTab("/path/to/doc2.md", "content2");
      openTab("/path/to/doc3.md", "content3");

      togglePinTab(tab1Id); // Pin tab1, it moves to front

      // Try to move unpinned tab (now index 2) to index 0 (pinned area)
      reorderTab(2, 0);

      // Unpinned tab should stay in unpinned section
      const state = useTabsStore.getState();
      expect(state.tabs[0].isPinned).toBe(true);
    });
  });

  describe("updateTabScroll", () => {
    it("updates scroll position for a tab", () => {
      const { openTab, updateTabScroll } = useTabsStore.getState();

      const tabId = openTab("/path/to/doc.md", "content");
      updateTabScroll(tabId, 500);

      expect(useTabsStore.getState().tabs[0].scrollTop).toBe(500);
    });
  });

  describe("findTabByPath", () => {
    it("finds tab by file path", () => {
      const { openTab, findTabByPath } = useTabsStore.getState();

      const tabId = openTab("/path/to/doc.md", "content");
      const found = findTabByPath("/path/to/doc.md");

      expect(found).toBeDefined();
      expect(found?.id).toBe(tabId);
    });

    it("returns undefined for non-existent path", () => {
      const { openTab, findTabByPath } = useTabsStore.getState();

      openTab("/path/to/doc.md", "content");
      const found = findTabByPath("/path/to/other.md");

      expect(found).toBeUndefined();
    });
  });

  describe("getActiveTab", () => {
    it("returns the active tab", () => {
      const { openTab, getActiveTab } = useTabsStore.getState();

      openTab("/path/to/doc1.md", "content1");
      const tab2Id = openTab("/path/to/doc2.md", "content2");

      const activeTab = getActiveTab();
      expect(activeTab?.id).toBe(tab2Id);
    });

    it("returns undefined when no tabs are open", () => {
      const { getActiveTab } = useTabsStore.getState();

      expect(getActiveTab()).toBeUndefined();
    });
  });

  describe("setSaveStatus", () => {
    it("updates save status", () => {
      const { setSaveStatus } = useTabsStore.getState();

      setSaveStatus("saving");
      expect(useTabsStore.getState().saveStatus).toBe("saving");
      expect(useTabsStore.getState().saveError).toBeNull();

      setSaveStatus("error", "Save failed");
      expect(useTabsStore.getState().saveStatus).toBe("error");
      expect(useTabsStore.getState().saveError).toBe("Save failed");

      setSaveStatus("saved");
      expect(useTabsStore.getState().saveStatus).toBe("saved");
      expect(useTabsStore.getState().saveError).toBeNull();
    });
  });

  describe("renameTab", () => {
    it("updates file path and display name when file is renamed", () => {
      const { openTab, renameTab } = useTabsStore.getState();

      openTab("/path/to/old-name.md", "content");

      renameTab("/path/to/old-name.md", "/path/to/new-name.md");

      const state = useTabsStore.getState();
      expect(state.tabs[0].filePath).toBe("/path/to/new-name.md");
      expect(state.tabs[0].displayName).toBe("new-name");
    });
  });

  describe("Selectors", () => {
    it("selectActiveTab returns active tab", () => {
      const { openTab } = useTabsStore.getState();

      openTab("/path/to/doc1.md", "content1");
      openTab("/path/to/doc2.md", "content2");

      const activeTab = selectActiveTab(useTabsStore.getState());
      expect(activeTab?.displayName).toBe("doc2");
    });

    it("selectHasUnsavedChanges returns true when any tab is dirty", () => {
      const { openTab, markTabDirty } = useTabsStore.getState();

      const tab1Id = openTab("/path/to/doc1.md", "content1");
      openTab("/path/to/doc2.md", "content2");

      expect(selectHasUnsavedChanges(useTabsStore.getState())).toBe(false);

      markTabDirty(tab1Id);
      expect(selectHasUnsavedChanges(useTabsStore.getState())).toBe(true);
    });
  });
});
