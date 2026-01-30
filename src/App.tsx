import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Editor, type EditorRef } from "@/components/editor/Editor";
import {
  FileTree,
  DocumentOutline,
  BacklinksPanel,
  SortDropdown,
} from "@/components/sidebar";
import { FindReplaceBar, GlobalSearchPanel } from "@/components/search";
import { SaveIndicator } from "@/components/ui/SaveIndicator";
import { VersionHistoryPanel, DiffViewer } from "@/components/history";
import { WelcomeScreen, RecentWorkspacesMenu } from "@/components/workspace";
import { ResizeHandle } from "@/components/layout";
import { TabBar, TabContextMenu } from "@/components/tabs";
import { SettingsPanel } from "@/components/settings";
import {
  useEditorStore,
  MIN_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
} from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useLinksStore } from "@/stores/linksStore";
import { useSearchStore } from "@/stores/searchStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTabsStore } from "@/stores/tabsStore";
import { getBacklinksForFile } from "@/lib/links/backlinks";
import { useAutosave } from "@/hooks/useAutosave";
import { useDocumentOutline } from "@/hooks/useDocumentOutline";
import {
  readDirectory,
  readFile,
  createFile,
  createFolder,
  renamePath,
  deletePath,
  openFolderDialog,
  joinPath,
  getFileName,
  getParentDir,
  type FileEntry,
} from "@/lib/tauri/files";
import { markdownToHtml } from "@/lib/markdown/markdownToHtml";
import { isWithinWorkspace } from "@/lib/links/linkService";
import { createFileSafe } from "@/lib/tauri/links";
import { renameFileWithLinkUpdates } from "@/lib/links/linkUpdater";
import { moveFileWithLinkUpdates, calculateNewPath } from "@/lib/links/moveFile";
import { clampFontSize, FONT_SIZE_STEP, FONT_SIZE_DEFAULT } from "@/lib/settings/typography";
import { getEffectiveAccent, resolveSystemTheme } from "@/lib/settings/themes";
import type { ThemeName } from "@/lib/settings/themes";
import { saveDocumentPipeline, saveAllDirtyTabs } from "@/services/saveService";
import "./index.css";

type SidebarTab = "files" | "outline" | "backlinks";

/**
 * Main application component
 */
function App() {
  // Use individual selectors to avoid React 19 + Zustand issues
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen);
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar);
  const sidebarWidth = useEditorStore((state) => state.sidebarWidth);
  const setSidebarWidth = useEditorStore((state) => state.setSidebarWidth);
  const zenMode = useEditorStore((state) => state.zenMode);
  const toggleZenMode = useEditorStore((state) => state.toggleZenMode);
  const isDirty = useEditorStore((state) => state.isDirty);
  const filePath = useEditorStore((state) => state.filePath);
  const setFilePath = useEditorStore((state) => state.setFilePath);
  const setContent = useEditorStore((state) => state.setContent);
  const markSaved = useEditorStore((state) => state.markSaved);
  const theme = useEditorStore((state) => state.theme);
  const setTheme = useEditorStore((state) => state.setTheme);
  const themeName = useEditorStore((state) => state.themeName);
  const setThemeName = useEditorStore((state) => state.setThemeName);
  const accentColorId = useEditorStore((state) => state.accentColorId);
  const setAccentColorId = useEditorStore((state) => state.setAccentColorId);
  const setFontFamily = useEditorStore((state) => state.setFontFamily);
  const fontSize = useEditorStore((state) => state.fontSize);
  const setFontSize = useEditorStore((state) => state.setFontSize);
  const lineHeight = useEditorStore((state) => state.lineHeight);
  const setLineHeight = useEditorStore((state) => state.setLineHeight);
  const maxLineWidth = useEditorStore((state) => state.maxLineWidth);
  const setMaxLineWidth = useEditorStore((state) => state.setMaxLineWidth);
  const typewriterMode = useEditorStore((state) => state.typewriterMode);
  const setTypewriterMode = useEditorStore((state) => state.toggleTypewriterMode);

  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const storeLoadWorkspace = useWorkspaceStore((state) => state.loadWorkspace);
  const setLoading = useWorkspaceStore((state) => state.setLoading);
  const setError = useWorkspaceStore((state) => state.setError);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const fileTree = useWorkspaceStore((state) => state.fileTree);

  // Get files list for backlinks building - derive from fileTree
  const allFiles = useMemo(() => {
    const files: Array<{ name: string; path: string; displayPath: string }> = [];
    const collectFiles = (entries: FileEntry[]) => {
      for (const entry of entries) {
        if (entry.is_markdown) {
          const displayPath = workspacePath
            ? entry.path.replace(workspacePath + "/", "")
            : entry.name;
          files.push({ name: entry.name, path: entry.path, displayPath });
        }
        if (entry.children) {
          collectFiles(entry.children);
        }
      }
    };
    collectFiles(fileTree);
    return files;
  }, [fileTree, workspacePath]);

  // Backlinks store - use shallow comparison for the index
  const { buildIndex, backlinksIndex, clearIndex } = useLinksStore(
    useShallow((state) => ({
      buildIndex: state.buildIndex,
      backlinksIndex: state.backlinksIndex,
      clearIndex: state.clearIndex,
    }))
  );
  const backlinks = useMemo(
    () => (filePath ? getBacklinksForFile(backlinksIndex, filePath) : []),
    [backlinksIndex, filePath]
  );

  const [editorContent, setEditorContent] = useState("");
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("files");
  const mainContentRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<EditorRef | null>(null);

  // Search store - individual selectors for React 19 compatibility
  const documentSearchOpen = useSearchStore((s) => s.documentSearchOpen);
  const openDocumentSearch = useSearchStore((s) => s.openDocumentSearch);
  const closeDocumentSearch = useSearchStore((s) => s.closeDocumentSearch);
  const globalSearchOpen = useSearchStore((s) => s.globalSearchOpen);
  const openGlobalSearch = useSearchStore((s) => s.openGlobalSearch);
  const closeGlobalSearch = useSearchStore((s) => s.closeGlobalSearch);

  // Settings store - for workspace management
  const recentWorkspaces = useSettingsStore((s) => s.recentWorkspaces);
  const defaultWorkspacePath = useSettingsStore((s) => s.defaultWorkspacePath);
  const layoutPrefs = useSettingsStore((s) => s.layout);
  const appearancePrefs = useSettingsStore((s) => s.appearance);
  const openTabsFromSettings = useSettingsStore((s) => s.openTabs);
  const settingsLoaded = useSettingsStore((s) => s.isLoaded);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const addRecentWorkspace = useSettingsStore((s) => s.addRecentWorkspace);
  const removeRecentWorkspace = useSettingsStore((s) => s.removeRecentWorkspace);
  const setDefaultWorkspace = useSettingsStore((s) => s.setDefaultWorkspace);
  const updateLayout = useSettingsStore((s) => s.updateLayout);
  const updateAppearance = useSettingsStore((s) => s.updateAppearance);
  const saveOpenTabs = useSettingsStore((s) => s.saveOpenTabs);

  // Tabs store - for multi-file editing
  const tabs = useTabsStore((s) => s.tabs);
  const activeTabId = useTabsStore((s) => s.activeTabId);
  const openTab = useTabsStore((s) => s.openTab);
  const closeTab = useTabsStore((s) => s.closeTab);
  const setActiveTab = useTabsStore((s) => s.setActiveTab);
  const updateTabContent = useTabsStore((s) => s.updateTabContent);
  const reorderTab = useTabsStore((s) => s.reorderTab);
  const findTabByPath = useTabsStore((s) => s.findTabByPath);
  const renameTab = useTabsStore((s) => s.renameTab);
  const togglePinTab = useTabsStore((s) => s.togglePinTab);
  const closeOtherTabs = useTabsStore((s) => s.closeOtherTabs);
  const closeAllTabs = useTabsStore((s) => s.closeAllTabs);

  // Tab context menu state
  const [tabContextMenu, setTabContextMenu] = useState<{
    tabId: string;
    position: { x: number; y: number };
  } | null>(null);

  // Version history state
  const [showHistory, setShowHistory] = useState(false);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [diffVersions, setDiffVersions] = useState<{ old: number; new: number } | null>(null);

  // Settings panel state
  const [showSettings, setShowSettings] = useState(false);

  // Document outline hook
  const { headings, activeHeadingId, scrollToHeading } = useDocumentOutline({
    content: editorContent,
    scrollContainerRef: mainContentRef,
  });

  // Autosave hook
  const { saveNow, checkCrashRecovery, recoverFromCrash } =
    useAutosave(editorContent);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Sync layout preferences from settings to editor store after settings load
  useEffect(() => {
    if (settingsLoaded && layoutPrefs) {
      // Only apply on initial load to avoid overwriting user changes
      setSidebarWidth(layoutPrefs.sidebarWidth);
      if (!layoutPrefs.sidebarOpen && sidebarOpen) {
        toggleSidebar();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  // Sync appearance preferences from settings to editor store after settings load
  useEffect(() => {
    if (settingsLoaded && appearancePrefs) {
      setTheme(appearancePrefs.theme);
      // Load new theme system preferences
      if (appearancePrefs.themeName) setThemeName(appearancePrefs.themeName);
      if (appearancePrefs.accentColorId !== undefined) setAccentColorId(appearancePrefs.accentColorId);
      setFontFamily(appearancePrefs.fontFamily);
      if (appearancePrefs.fontSize) setFontSize(appearancePrefs.fontSize);
      if (appearancePrefs.lineHeight) setLineHeight(appearancePrefs.lineHeight);
      if (appearancePrefs.maxLineWidth) setMaxLineWidth(appearancePrefs.maxLineWidth);
      // typewriterMode is synced via store default, toggle if different
      if (appearancePrefs.typewriterMode !== undefined && appearancePrefs.typewriterMode !== typewriterMode) {
        setTypewriterMode();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsLoaded]);

  // Apply theme to document element when theme or themeName changes
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      // Remove data-theme to let CSS media queries handle it
      // System preference will use paper (light) or midnight (dark)
      root.removeAttribute("data-theme");
    } else {
      // Use themeName for the full theme palette, fallback to theme for legacy compatibility
      root.setAttribute("data-theme", themeName || theme);
    }
  }, [theme, themeName]);

  // Apply custom accent color when accentColorId changes
  useEffect(() => {
    const root = document.documentElement;
    // Resolve the effective theme name (handle system preference)
    const effectiveThemeName: ThemeName =
      theme === "system" ? resolveSystemTheme() : (themeName || "paper");
    const accent = getEffectiveAccent(effectiveThemeName, accentColorId);

    // Apply custom accent via CSS custom properties
    root.style.setProperty("--custom-accent-color", accent.color);
    root.style.setProperty("--custom-accent-soft", accent.soft);

    // Set the flag to enable accent override
    if (accentColorId) {
      root.setAttribute("data-accent-color", accentColorId);
    } else {
      root.removeAttribute("data-accent-color");
    }
  }, [theme, themeName, accentColorId]);

  // Apply typography settings to CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--editor-font-size", `${fontSize}px`);
    root.style.setProperty("--editor-line-height", `${lineHeight}`);
    root.style.setProperty("--editor-max-width", `${maxLineWidth}ch`);
  }, [fontSize, lineHeight, maxLineWidth]);

  // Track if tabs have been restored to avoid double restore
  const tabsRestoredRef = useRef(false);

  // Restore tabs from settings after workspace loads
  useEffect(() => {
    const restoreTabs = async () => {
      if (!settingsLoaded || !workspacePath || tabsRestoredRef.current) return;
      if (!openTabsFromSettings || openTabsFromSettings.tabs.length === 0) return;

      tabsRestoredRef.current = true;

      // Restore each tab
      for (const persistedTab of openTabsFromSettings.tabs) {
        try {
          // Check if file still exists by trying to read it
          const markdownContent = await readFile(persistedTab.filePath);
          const htmlContent = markdownToHtml(markdownContent);
          const tabId = openTab(persistedTab.filePath, htmlContent);

          // Restore pinned state
          if (persistedTab.isPinned) {
            togglePinTab(tabId);
          }
        } catch {
          // File no longer exists, skip it silently
        }
      }

      // Set active tab
      if (openTabsFromSettings.activeTabPath) {
        const activeTab = findTabByPath(openTabsFromSettings.activeTabPath);
        if (activeTab) {
          setActiveTab(activeTab.id);
          setEditorContent(activeTab.content);
          setFilePath(activeTab.filePath);
          setContent(activeTab.content);
          markSaved();
        }
      }
    };

    restoreTabs();
  }, [
    settingsLoaded,
    workspacePath,
    openTabsFromSettings,
    openTab,
    togglePinTab,
    findTabByPath,
    setActiveTab,
    setFilePath,
    setContent,
    markSaved,
  ]);

  // Save tabs to settings when they change (debounced)
  const saveTabsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Don't save during initial restoration
    if (!tabsRestoredRef.current && tabs.length === 0) return;

    // Debounce tab saves
    if (saveTabsTimeoutRef.current) {
      clearTimeout(saveTabsTimeoutRef.current);
    }

    saveTabsTimeoutRef.current = setTimeout(() => {
      const activeTab = tabs.find((t) => t.id === activeTabId);
      saveOpenTabs({
        tabs: tabs.map((t) => ({
          filePath: t.filePath,
          isPinned: t.isPinned,
        })),
        activeTabPath: activeTab?.filePath ?? null,
      });
    }, 1000);

    return () => {
      if (saveTabsTimeoutRef.current) {
        clearTimeout(saveTabsTimeoutRef.current);
      }
    };
  }, [tabs, activeTabId, saveOpenTabs]);

  // Check for crash recovery on mount
  useEffect(() => {
    const recoveryData = checkCrashRecovery();
    if (recoveryData && recoveryData.content) {
      const shouldRecover = window.confirm(
        "It looks like Jot didn't close properly. Would you like to recover your unsaved changes?"
      );
      if (shouldRecover) {
        recoverFromCrash(recoveryData);
        setEditorContent(recoveryData.content);
        if (recoveryData.filePath) {
          setFilePath(recoveryData.filePath);
        }
      }
    }
  }, [checkCrashRecovery, recoverFromCrash, setFilePath]);

  // Load workspace directory
  const loadWorkspace = useCallback(
    async (path: string) => {
      setLoading(true);
      setError(null);

      try {
        const entries = await readDirectory(path);
        storeLoadWorkspace(path, entries);

        // Add to recent workspaces
        const name = getFileName(path);
        addRecentWorkspace(path, name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workspace");
        console.error("Failed to load workspace:", err);
      } finally {
        setLoading(false);
      }
    },
    [storeLoadWorkspace, setLoading, setError, addRecentWorkspace]
  );

  // Auto-open default workspace after settings load
  useEffect(() => {
    if (settingsLoaded && defaultWorkspacePath && !workspacePath) {
      loadWorkspace(defaultWorkspacePath);
    }
  }, [settingsLoaded, defaultWorkspacePath, workspacePath, loadWorkspace]);

  // Clear workspace state (tabs, editor, links index)
  const clearWorkspaceState = useCallback(() => {
    // Close all tabs (keeps pinned, but we want to clear everything)
    closeAllTabs();

    // Clear editor state
    setEditorContent("");
    setFilePath(null);
    setContent("");
    markSaved();

    // Clear backlinks index
    clearIndex();

    // Reset tab restoration flag for new workspace
    tabsRestoredRef.current = false;
  }, [closeAllTabs, setFilePath, setContent, markSaved, clearIndex]);

  // Handle dirty tabs before workspace switch
  // Returns true if we should proceed, false if cancelled
  const handleDirtyTabsBeforeSwitch = useCallback(async (): Promise<boolean> => {
    const dirtyTabs = tabs.filter((t) => t.isDirty);

    if (dirtyTabs.length === 0) {
      return true; // No dirty tabs, proceed
    }

    const message =
      dirtyTabs.length === 1
        ? `"${dirtyTabs[0].displayName}" has unsaved changes. Save before switching workspaces?\n\nClick OK to save, or Cancel to abort.`
        : `You have ${dirtyTabs.length} unsaved files. Save all before switching workspaces?\n\nClick OK to save all, or Cancel to abort.`;

    const shouldSave = window.confirm(message);

    if (shouldSave) {
      // Save all dirty tabs using unified pipeline
      const failedTabs = await saveAllDirtyTabs(activeTabId);
      if (failedTabs.length > 0) {
        console.error(`Failed to save ${failedTabs.length} tabs`);
        // Ask if user wants to continue anyway
        const continueAnyway = window.confirm(
          `Failed to save ${failedTabs.length} file(s). Switch workspace anyway and lose changes?`
        );
        return continueAnyway;
      }
      return true;
    } else {
      // User clicked Cancel
      return false;
    }
  }, [tabs, activeTabId]);

  // Open folder dialog
  const handleOpenFolder = useCallback(async () => {
    // Handle dirty tabs before switching
    const shouldProceed = await handleDirtyTabsBeforeSwitch();
    if (!shouldProceed) {
      return;
    }

    try {
      const path = await openFolderDialog();
      if (path) {
        // Clear current workspace state before loading new one
        clearWorkspaceState();
        await loadWorkspace(path);
      }
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  }, [loadWorkspace, handleDirtyTabsBeforeSwitch, clearWorkspaceState]);

  // Open workspace from recent list
  const handleOpenWorkspace = useCallback(
    async (path: string) => {
      // Handle dirty tabs before switching
      const shouldProceed = await handleDirtyTabsBeforeSwitch();
      if (!shouldProceed) {
        return;
      }

      // Clear current workspace state before loading new one
      clearWorkspaceState();
      await loadWorkspace(path);
    },
    [loadWorkspace, handleDirtyTabsBeforeSwitch, clearWorkspaceState]
  );

  // Build backlinks index when workspace files change
  useEffect(() => {
    const buildBacklinksIndex = async () => {
      if (!workspacePath || allFiles.length === 0) return;

      try {
        // Read content of all markdown files
        const fileContents = await Promise.all(
          allFiles.map(async (file) => {
            try {
              const content = await readFile(file.path);
              return {
                path: file.path,
                name: file.name,
                content,
              };
            } catch {
              // Skip files that can't be read
              return null;
            }
          })
        );

        // Filter out failed reads and build index
        const validFiles = fileContents.filter((f): f is NonNullable<typeof f> => f !== null);
        buildIndex(validFiles, workspacePath);
      } catch (err) {
        console.error("Failed to build backlinks index:", err);
      }
    };

    buildBacklinksIndex();
  }, [workspacePath, allFiles, buildIndex]);

  // Open file in a tab - saves current file first if dirty
  const handleFileSelect = useCallback(
    async (path: string) => {
      // Check if file is already open in a tab
      const existingTab = findTabByPath(path);
      if (existingTab) {
        // Switch to the existing tab
        setActiveTab(existingTab.id);
        setEditorContent(existingTab.content);
        setFilePath(path);
        setContent(existingTab.content);
        // Only mark as saved if the tab doesn't have pending changes
        if (!existingTab.isDirty) {
          markSaved();
        }
        return;
      }

      // Save current file if it has unsaved changes
      if (isDirty && filePath) {
        saveNow();
      }

      try {
        // Read file content (Markdown on disk)
        const markdownContent = await readFile(path);
        // Convert Markdown to HTML for TipTap editor
        const htmlContent = markdownToHtml(markdownContent);

        // Open in a new tab
        openTab(path, htmlContent);

        // Sync with editor state
        setEditorContent(htmlContent);
        setFilePath(path);
        setContent(htmlContent);
        markSaved();
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    },
    [isDirty, filePath, saveNow, setFilePath, setContent, markSaved, findTabByPath, setActiveTab, openTab]
  );

  // Save file (immediate save via Cmd+S)
  const handleSave = useCallback(() => {
    if (!filePath) return;
    saveNow();
  }, [filePath, saveNow]);

  // Handle content changes - syncs both local and store state, marks dirty for autosave
  const handleEditorUpdate = useCallback(
    (content: string) => {
      setEditorContent(content);
      setContent(content); // Sync to store and mark dirty

      // Also update the active tab's content
      if (activeTabId) {
        updateTabContent(activeTabId, content);
      }
    },
    [setContent, activeTabId, updateTabContent]
  );

  // Handle tab selection
  const handleTabSelect = useCallback(
    (tabId: string) => {
      // Save current file if dirty before switching
      if (isDirty && filePath) {
        saveNow();
      }

      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      setActiveTab(tabId);
      setEditorContent(tab.content);
      setFilePath(tab.filePath);
      setContent(tab.content);

      // Only mark as saved if the tab doesn't have pending changes
      if (!tab.isDirty) {
        markSaved();
      }
    },
    [tabs, isDirty, filePath, saveNow, setActiveTab, setFilePath, setContent, markSaved]
  );

  // Handle tab close
  const handleTabClose = useCallback(
    async (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;

      // Prompt if dirty
      if (tab.isDirty) {
        const shouldSave = window.confirm(
          `"${tab.displayName}" has unsaved changes. Save before closing?\n\nClick OK to save, or Cancel to keep the tab open.`
        );
        if (shouldSave) {
          // Use unified save pipeline - works for any tab, not just active
          try {
            await saveDocumentPipeline(tabId, tabId === activeTabId);
          } catch (error) {
            console.error("Failed to save tab before closing:", error);
            // Don't close if save failed
            return;
          }
        } else {
          // User clicked Cancel - abort the close operation
          return;
        }
      }

      const nextTabId = closeTab(tabId);

      // If we closed the active tab, switch to the next one
      if (tabId === activeTabId) {
        if (nextTabId) {
          const nextTab = tabs.find((t) => t.id === nextTabId);
          if (nextTab) {
            setEditorContent(nextTab.content);
            setFilePath(nextTab.filePath);
            setContent(nextTab.content);
            if (!nextTab.isDirty) {
              markSaved();
            }
          }
        } else {
          // No more tabs
          setEditorContent("");
          setFilePath(null);
          setContent("");
          markSaved();
        }
      }
    },
    [tabs, activeTabId, closeTab, setFilePath, setContent, markSaved]
  );

  // Handle tab reorder
  const handleTabReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      reorderTab(fromIndex, toIndex);
    },
    [reorderTab]
  );

  // Handle tab context menu
  const handleTabContextMenu = useCallback(
    (tabId: string, position: { x: number; y: number }) => {
      setTabContextMenu({ tabId, position });
    },
    []
  );

  // Handle tab pin toggle
  const handleTabPin = useCallback(() => {
    if (tabContextMenu) {
      togglePinTab(tabContextMenu.tabId);
    }
  }, [tabContextMenu, togglePinTab]);

  // Handle close others from context menu
  const handleCloseOtherTabs = useCallback(() => {
    if (tabContextMenu) {
      closeOtherTabs(tabContextMenu.tabId);

      // Read fresh state after mutation
      const freshTabs = useTabsStore.getState().tabs;
      const freshActiveTabId = useTabsStore.getState().activeTabId;

      // Update editor state if needed
      const remainingTab = freshTabs.find(
        (t) => t.id === tabContextMenu.tabId || t.isPinned
      );
      if (remainingTab && remainingTab.id !== freshActiveTabId) {
        setEditorContent(remainingTab.content);
        setFilePath(remainingTab.filePath);
        setContent(remainingTab.content);
        if (!remainingTab.isDirty) {
          markSaved();
        }
      }
    }
  }, [tabContextMenu, closeOtherTabs, setFilePath, setContent, markSaved]);

  // Handle close all from context menu
  const handleCloseAllTabs = useCallback(async () => {
    // Check for dirty tabs (excluding pinned, which won't be closed)
    const dirtyTabs = tabs.filter((t) => t.isDirty && !t.isPinned);
    if (dirtyTabs.length > 0) {
      const shouldSave = window.confirm(
        `You have ${dirtyTabs.length} unsaved file(s). Save all before closing?\n\nClick OK to save all, or Cancel to abort.`
      );
      if (shouldSave) {
        // Save all dirty tabs using unified pipeline
        const failedTabs = await saveAllDirtyTabs(activeTabId);
        if (failedTabs.length > 0) {
          console.error(`Failed to save ${failedTabs.length} tabs`);
          // Don't proceed if some saves failed
          return;
        }
      } else {
        // User clicked Cancel - abort the operation
        return;
      }
    }

    closeAllTabs();

    // Read fresh state after mutation
    const freshTabs = useTabsStore.getState().tabs;

    // Check if any pinned tabs remain (freshTabs now reflects post-closeAllTabs state)
    if (freshTabs.length > 0) {
      setEditorContent(freshTabs[0].content);
      setFilePath(freshTabs[0].filePath);
      setContent(freshTabs[0].content);
      if (!freshTabs[0].isDirty) {
        markSaved();
      }
    } else {
      setEditorContent("");
      setFilePath(null);
      setContent("");
      markSaved();
    }
  }, [tabs, activeTabId, closeAllTabs, setFilePath, setContent, markSaved]);

  // Dismiss tab context menu
  const handleDismissTabContextMenu = useCallback(() => {
    setTabContextMenu(null);
  }, []);

  // Persist sidebar toggle to settings
  const handleToggleSidebar = useCallback(() => {
    const newState = !sidebarOpen;
    toggleSidebar();
    updateLayout({ sidebarOpen: newState });
  }, [sidebarOpen, toggleSidebar, updateLayout]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl + S: Save
      if (isMod && e.key === "s") {
        e.preventDefault();
        handleSave();
      }

      // Cmd/Ctrl + O: Open folder
      if (isMod && e.key === "o" && !e.shiftKey) {
        e.preventDefault();
        handleOpenFolder();
      }

      // Cmd/Ctrl + Shift + O: Open recent workspace (focus the dropdown)
      // Note: The dropdown handles its own state internally

      // Cmd/Ctrl + B: Toggle sidebar
      if (isMod && e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        handleToggleSidebar();
      }

      // Cmd/Ctrl + Shift + F: Zen mode (when not searching)
      // Note: Cmd+Shift+F for global search takes precedence when workspace is open
      // Escape exits zen mode
      if (e.key === "Escape" && zenMode) {
        e.preventDefault();
        toggleZenMode();
        return;
      }

      // Cmd/Ctrl + F: Find in document
      if (isMod && e.key === "f" && !e.shiftKey) {
        e.preventDefault();
        if (filePath) {
          openDocumentSearch();
        }
      }

      // Cmd/Ctrl + Shift + F: Global search
      if (isMod && e.key === "f" && e.shiftKey) {
        e.preventDefault();
        if (workspacePath) {
          openGlobalSearch();
        }
      }

      // Escape: Close search panels
      if (e.key === "Escape") {
        if (documentSearchOpen) {
          e.preventDefault();
          closeDocumentSearch();
          editorRef.current?.editor?.commands.clearSearch();
        } else if (globalSearchOpen) {
          e.preventDefault();
          closeGlobalSearch();
        }
      }

      // Cmd/Ctrl + Plus: Increase font size
      if (isMod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        const newSize = clampFontSize(fontSize + FONT_SIZE_STEP);
        setFontSize(newSize);
        updateAppearance({ fontSize: newSize });
      }

      // Cmd/Ctrl + Minus: Decrease font size
      if (isMod && e.key === "-") {
        e.preventDefault();
        const newSize = clampFontSize(fontSize - FONT_SIZE_STEP);
        setFontSize(newSize);
        updateAppearance({ fontSize: newSize });
      }

      // Cmd/Ctrl + 0: Reset font size to default
      if (isMod && e.key === "0") {
        e.preventDefault();
        setFontSize(FONT_SIZE_DEFAULT);
        updateAppearance({ fontSize: FONT_SIZE_DEFAULT });
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    handleSave,
    handleOpenFolder,
    handleToggleSidebar,
    filePath,
    workspacePath,
    documentSearchOpen,
    openDocumentSearch,
    closeDocumentSearch,
    globalSearchOpen,
    openGlobalSearch,
    closeGlobalSearch,
    zenMode,
    toggleZenMode,
    fontSize,
    setFontSize,
    updateAppearance,
  ]);

  // Create new file
  const handleCreateFile = useCallback(
    async (parentPath: string) => {
      const name = window.prompt("File name:", "untitled.md");
      if (!name) return;

      const fileName = name.endsWith(".md") ? name : `${name}.md`;
      const newPath = joinPath(parentPath, fileName);

      try {
        await createFile(newPath);
        // Reload workspace to show new file
        if (workspacePath) {
          await loadWorkspace(workspacePath);
        }
        // Open the new file
        handleFileSelect(newPath);
      } catch (err) {
        console.error("Failed to create file:", err);
        alert(err instanceof Error ? err.message : "Failed to create file");
      }
    },
    [workspacePath, loadWorkspace, handleFileSelect]
  );

  // Create new folder
  const handleCreateFolder = useCallback(
    async (parentPath: string) => {
      const name = window.prompt("Folder name:");
      if (!name) return;

      const newPath = joinPath(parentPath, name);

      try {
        await createFolder(newPath);
        if (workspacePath) {
          await loadWorkspace(workspacePath);
        }
      } catch (err) {
        console.error("Failed to create folder:", err);
        alert(err instanceof Error ? err.message : "Failed to create folder");
      }
    },
    [workspacePath, loadWorkspace]
  );

  // Rename file/folder with automatic link updates
  const handleRename = useCallback(
    async (path: string) => {
      const currentName = getFileName(path);
      const newName = window.prompt("New name:", currentName);
      if (!newName || newName === currentName) return;

      const parentPath = getParentDir(path);
      const newPath = joinPath(parentPath, newName);

      try {
        // Get files that link to this file (only for .md files)
        const isMarkdown = path.endsWith(".md");
        const backlinks = isMarkdown
          ? useLinksStore.getState().getBacklinks(path)
          : [];

        if (backlinks.length > 0 && workspacePath) {
          // Update links in affected files, then rename
          const { errors } = await renameFileWithLinkUpdates(
            path,
            newPath,
            workspacePath,
            backlinks
          );

          if (errors.length > 0) {
            console.warn("Some link updates failed:", errors);
          }
        } else {
          // No backlinks, just rename
          await renamePath(path, newPath);
        }

        if (workspacePath) {
          await loadWorkspace(workspacePath);
        }
        // Update editor if this was the open file
        if (filePath === path) {
          setFilePath(newPath);
        }
        // Update tab if this file is open in a tab
        renameTab(path, newPath);
      } catch (err) {
        console.error("Failed to rename:", err);
        alert(err instanceof Error ? err.message : "Failed to rename");
      }
    },
    [workspacePath, loadWorkspace, filePath, setFilePath, renameTab]
  );

  // Delete file/folder
  const handleDelete = useCallback(
    async (path: string) => {
      const name = getFileName(path);
      const confirmed = window.confirm(`Delete "${name}"?`);
      if (!confirmed) return;

      try {
        await deletePath(path);
        if (workspacePath) {
          await loadWorkspace(workspacePath);
        }
        // Clear editor if this was the open file
        if (filePath === path) {
          setFilePath(null);
          setEditorContent("");
          setContent("");
        }
      } catch (err) {
        console.error("Failed to delete:", err);
        alert(err instanceof Error ? err.message : "Failed to delete");
      }
    },
    [workspacePath, loadWorkspace, filePath, setFilePath, setContent]
  );

  // Move file/folder with automatic link updates
  const handleMove = useCallback(
    async (sourcePath: string, targetFolderPath: string) => {
      if (!workspacePath) return;

      const fileName = getFileName(sourcePath);
      const newPath = calculateNewPath(sourcePath, targetFolderPath);

      try {
        // Get files that link to this file (only for .md files)
        const isMarkdown = sourcePath.endsWith(".md");
        const backlinks = isMarkdown
          ? useLinksStore.getState().getBacklinks(sourcePath)
          : [];

        const { errors } = await moveFileWithLinkUpdates(
          sourcePath,
          targetFolderPath,
          workspacePath,
          backlinks
        );

        if (errors.length > 0) {
          console.warn("Some link updates failed:", errors);
        }

        // Reload workspace to reflect changes
        await loadWorkspace(workspacePath);

        // Update editor if this was the open file
        if (filePath === sourcePath) {
          setFilePath(newPath);
        }
      } catch (err) {
        console.error("Failed to move:", err);
        alert(err instanceof Error ? err.message : `Failed to move "${fileName}"`);
      }
    },
    [workspacePath, loadWorkspace, filePath, setFilePath]
  );

  // Handle internal link click - navigate to file and optionally scroll to heading
  const pendingHeadingRef = useRef<string | undefined>(undefined);

  // Handle same-file heading navigation - scroll without reloading file
  const handleScrollToHeading = useCallback((heading: string) => {
    const headingElement = document.getElementById(heading);
    if (headingElement) {
      headingElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleInternalLinkClick = useCallback(
    async (path: string, heading?: string) => {
      // Store the heading to scroll to after file loads
      pendingHeadingRef.current = heading;

      // Navigate to the file
      await handleFileSelect(path);

      // If there's a heading anchor, scroll to it after a brief delay
      // (allow content to render)
      if (heading) {
        setTimeout(() => {
          const headingElement = document.getElementById(heading);
          if (headingElement) {
            headingElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
          pendingHeadingRef.current = undefined;
        }, 100);
      }
    },
    [handleFileSelect]
  );

  // Handle version restore
  const handleVersionRestore = useCallback(
    (content: string) => {
      // Content from version history is in markdown format
      // Convert to HTML for the editor
      const htmlContent = markdownToHtml(content);
      setEditorContent(htmlContent);
      setContent(htmlContent);
      setShowHistory(false);
    },
    [setContent]
  );

  // Handle compare versions
  const handleCompareVersions = useCallback(
    (oldVersionId: number, newVersionId: number) => {
      setDiffVersions({ old: oldVersionId, new: newVersionId });
      setShowDiffViewer(true);
      setShowHistory(false);
    },
    []
  );

  // Handle global search result click - open file and scroll to line
  const handleGlobalSearchResultClick = useCallback(
    async (resultFilePath: string, _lineNumber: number) => {
      // Open the file if not already open
      if (filePath !== resultFilePath) {
        await handleFileSelect(resultFilePath);
      }

      // TODO: Scroll to the specific line in the editor
      // For now, we just open the file

      // Close the global search panel
      closeGlobalSearch();
    },
    [filePath, handleFileSelect, closeGlobalSearch]
  );

  // Handle broken link click - offer to create the file
  const handleBrokenLinkClick = useCallback(
    async (intendedPath: string) => {
      // Security check: validate path is within workspace (defense in depth)
      if (workspacePath && !isWithinWorkspace(intendedPath, workspacePath)) {
        console.warn(`Blocked path traversal attempt: ${intendedPath}`);
        alert("Cannot create file outside workspace.");
        return;
      }

      const fileName = getFileName(intendedPath);
      const shouldCreate = window.confirm(
        `"${fileName}" doesn't exist. Would you like to create it?`
      );

      if (shouldCreate && workspacePath) {
        try {
          // Create the file using safe version (Rust validates path is within workspace)
          await createFileSafe(intendedPath, workspacePath);

          // Reload workspace to show new file
          await loadWorkspace(workspacePath);

          // Open the new file
          await handleFileSelect(intendedPath);
        } catch (err) {
          console.error("Failed to create file:", err);
          alert(err instanceof Error ? err.message : "Failed to create file");
        }
      }
    },
    [workspacePath, loadWorkspace, handleFileSelect]
  );

  // Handle sidebar resize
  const handleSidebarResize = useCallback((width: number) => {
    setSidebarWidth(width);
  }, [setSidebarWidth]);

  // Handle resize end - persist to settings
  const handleSidebarResizeEnd = useCallback((width: number) => {
    updateLayout({ sidebarWidth: width });
  }, [updateLayout]);

  return (
    <div className={`app-layout ${zenMode ? "zen-mode" : ""}`}>
      {/* Sidebar Container with Resize Handle */}
      <div
        className={`sidebar-container ${sidebarOpen && !zenMode ? "" : "collapsed"}`}
        style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
      >
        <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title-row">
            <h2 className="sidebar-title">
              {workspacePath ? getFileName(workspacePath) : "Jot"}
            </h2>
            {workspacePath && recentWorkspaces.length > 0 && (
              <RecentWorkspacesMenu
                recentWorkspaces={recentWorkspaces}
                currentWorkspacePath={workspacePath}
                defaultWorkspacePath={defaultWorkspacePath}
                onOpenWorkspace={handleOpenWorkspace}
                onOpenFolder={handleOpenFolder}
                onSetDefault={setDefaultWorkspace}
              />
            )}
          </div>
          <div className="sidebar-actions">
            <button
              className="sidebar-action-btn"
              onClick={() => workspacePath && handleCreateFile(workspacePath)}
              title="New file"
              disabled={!workspacePath}
            >
              <NewFileIcon />
            </button>
            <button
              className="sidebar-action-btn"
              onClick={handleOpenFolder}
              title="Open folder"
            >
              <FolderOpenIcon />
            </button>
          </div>
        </div>

        {/* Sidebar Tabs */}
        <div className="sidebar-tabs">
          <button
            className={`sidebar-tab ${activeSidebarTab === "files" ? "active" : ""}`}
            onClick={() => setActiveSidebarTab("files")}
          >
            <FilesTabIcon />
            <span>Files</span>
          </button>
          <button
            className={`sidebar-tab ${activeSidebarTab === "outline" ? "active" : ""}`}
            onClick={() => setActiveSidebarTab("outline")}
            disabled={!filePath}
            title={!filePath ? "Open a file to see outline" : undefined}
          >
            <OutlineTabIcon />
            <span>Outline</span>
          </button>
          <button
            className={`sidebar-tab ${activeSidebarTab === "backlinks" ? "active" : ""}`}
            onClick={() => setActiveSidebarTab("backlinks")}
            disabled={!filePath}
            title={!filePath ? "Open a file to see backlinks" : undefined}
          >
            <BacklinksTabIcon />
            <span>Links</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeSidebarTab === "files" && (
          <>
            {!workspacePath ? (
              <button className="open-folder-btn" onClick={handleOpenFolder}>
                <FolderOpenIcon />
                <span>Open Folder</span>
              </button>
            ) : isLoading ? (
              <div className="file-tree-empty-state">
                <p>Loading...</p>
              </div>
            ) : (
              <>
                <div className="file-tree-controls">
                  <SortDropdown />
                </div>
                <FileTree
                  onFileSelect={handleFileSelect}
                  onCreateFile={handleCreateFile}
                  onCreateFolder={handleCreateFolder}
                  onRename={handleRename}
                  onDelete={handleDelete}
                  onMove={handleMove}
                />
              </>
            )}
          </>
        )}
        {activeSidebarTab === "outline" && (
          <DocumentOutline
            headings={headings}
            activeHeadingId={activeHeadingId}
            onHeadingClick={scrollToHeading}
          />
        )}
        {activeSidebarTab === "backlinks" && (
          <BacklinksPanel
            backlinks={backlinks}
            onBacklinkClick={handleFileSelect}
          />
        )}
        </aside>

        {/* Resize Handle */}
        <ResizeHandle
          width={sidebarWidth}
          minWidth={MIN_SIDEBAR_WIDTH}
          maxWidth={MAX_SIDEBAR_WIDTH}
          onResize={handleSidebarResize}
          onResizeEnd={handleSidebarResizeEnd}
          disabled={!sidebarOpen || zenMode}
        />
      </div>

      {/* Main Content */}
      <main className="main-content" ref={mainContentRef}>
        {/* Title bar */}
        <div className="title-bar">
          <div className="title-bar-left">
            <button
              className="sidebar-toggle-btn"
              onClick={handleToggleSidebar}
              title={sidebarOpen ? "Hide sidebar (⌘B)" : "Show sidebar (⌘B)"}
            >
              <SidebarIcon />
            </button>
            <span className="document-title">
              {filePath ? getFileName(filePath) : "Untitled"}
              {isDirty && <span className="unsaved-dot">•</span>}
            </span>
            <SaveIndicator />
          </div>
          <div className="title-bar-right">
            <button
              className="title-bar-btn"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              <SettingsIcon />
            </button>
            <button
              className={`title-bar-btn ${zenMode ? "active" : ""}`}
              onClick={toggleZenMode}
              title={zenMode ? "Exit zen mode (Esc)" : "Zen mode"}
            >
              <ZenModeIcon />
            </button>
            {filePath && workspacePath && (
              <button
                className="title-bar-btn"
                onClick={() => setShowHistory(!showHistory)}
                title="Version history"
              >
                <HistoryIcon />
              </button>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        {tabs.length > 0 && (
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose}
            onTabReorder={handleTabReorder}
            onTabContextMenu={handleTabContextMenu}
          />
        )}

        {/* Editor */}
        {filePath ? (
          <div className="editor-wrapper">
            {/* Find/Replace Bar */}
            {documentSearchOpen && (
              <FindReplaceBar
                editor={editorRef.current?.editor ?? null}
                onClose={() => {
                  closeDocumentSearch();
                  editorRef.current?.editor?.commands.clearSearch();
                }}
              />
            )}
            <Editor
              ref={editorRef}
              initialContent={editorContent}
              onUpdate={handleEditorUpdate}
              placeholder="Start writing..."
              onInternalLinkClick={handleInternalLinkClick}
              onScrollToHeading={handleScrollToHeading}
              onBrokenLinkClick={handleBrokenLinkClick}
            />
          </div>
        ) : (
          <WelcomeScreen
            recentWorkspaces={recentWorkspaces}
            defaultWorkspacePath={defaultWorkspacePath}
            onOpenFolder={handleOpenFolder}
            onOpenWorkspace={handleOpenWorkspace}
            onSetDefault={setDefaultWorkspace}
            onRemoveRecent={removeRecentWorkspace}
          />
        )}
      </main>

      {/* Global Search Panel */}
      {globalSearchOpen && workspacePath && (
        <GlobalSearchPanel
          workspacePath={workspacePath}
          onResultClick={handleGlobalSearchResultClick}
          onClose={closeGlobalSearch}
        />
      )}

      {/* Version History Panel */}
      {showHistory && filePath && workspacePath && (
        <VersionHistoryPanel
          filePath={filePath}
          workspacePath={workspacePath}
          onRestore={handleVersionRestore}
          onClose={() => setShowHistory(false)}
          onCompare={handleCompareVersions}
        />
      )}

      {/* Diff Viewer */}
      {showDiffViewer && diffVersions && workspacePath && (
        <DiffViewer
          workspacePath={workspacePath}
          oldVersionId={diffVersions.old}
          newVersionId={diffVersions.new}
          onClose={() => {
            setShowDiffViewer(false);
            setDiffVersions(null);
          }}
          onRestoreOld={(content) => {
            handleVersionRestore(content);
            setShowDiffViewer(false);
            setDiffVersions(null);
          }}
          onRestoreNew={(content) => {
            handleVersionRestore(content);
            setShowDiffViewer(false);
            setDiffVersions(null);
          }}
        />
      )}

      {/* Tab Context Menu */}
      {tabContextMenu && (
        <TabContextMenu
          position={tabContextMenu.position}
          isPinned={tabs.find((t) => t.id === tabContextMenu.tabId)?.isPinned ?? false}
          onPin={handleTabPin}
          onClose={() => handleTabClose(tabContextMenu.tabId)}
          onCloseOthers={handleCloseOtherTabs}
          onCloseAll={handleCloseAllTabs}
          onDismiss={handleDismissTabContextMenu}
        />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}

// Icons

function SidebarIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function FolderOpenIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path d="M2 10h20" />
    </svg>
  );
}

function NewFileIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function FilesTabIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}

function OutlineTabIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function BacklinksTabIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ZenModeIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default App;
