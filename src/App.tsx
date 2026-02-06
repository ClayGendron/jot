import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";
import { CodeMirrorEditor, type CodeMirrorEditorRef } from "@/components/editor/codemirror";
import {
  FileTree,
  DocumentOutline,
  BacklinksPanel,
  SortDropdown,
} from "@/components/sidebar";
import { GlobalSearchPanel } from "@/components/search";
import {
  SemanticSearchPanel,
  RelatedDocumentsPanel,
  SemanticSetupDialog,
} from "@/components/semantic";
import { SaveIndicator } from "@/components/ui/SaveIndicator";
import { VersionHistoryPanel, DiffViewer } from "@/components/history";
import { WelcomeScreen, RecentWorkspacesMenu } from "@/components/workspace";
import { ResizeHandle } from "@/components/layout";
import { TabBar, TabContextMenu } from "@/components/tabs";
import { SettingsPanel } from "@/components/settings";
import { ExportPanel } from "@/components/export";
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
import { useSemanticSearchStore } from "@/stores/semanticSearchStore";
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
  getFileName,
  isCaseSensitiveFs,
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
import { getRelativePath, joinFsPaths, getParentPath } from "@/lib/path/pathUtils";
import { saveDocumentPipeline, saveAllDirtyTabs } from "@/services/saveService";
import { indexFolder } from "@/services/semanticIndexingService";
import {
  PanelLeft,
  FolderOpen,
  FilePlus,
  Folder,
  List,
  Link,
  Clock,
  Maximize,
  Settings,
  Upload,
} from "lucide-react";
import "./styles/index.css";

type SidebarTab = "files" | "outline" | "backlinks" | "related";

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
  const caseSensitiveFs = useEditorStore((state) => state.isCaseSensitiveFs);
  const setIsCaseSensitiveFs = useEditorStore((state) => state.setIsCaseSensitiveFs);

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
          // Use getRelativePath for cross-platform consistency (Windows backslashes → forward slashes)
          const displayPath = workspacePath
            ? getRelativePath(workspacePath, entry.path) || entry.name
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
    () => (filePath ? getBacklinksForFile(backlinksIndex, filePath, caseSensitiveFs) : []),
    [backlinksIndex, filePath, caseSensitiveFs]
  );

  const [editorContent, setEditorContent] = useState("");
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>("files");
  const mainContentRef = useRef<HTMLElement | null>(null);
  const editorRef = useRef<CodeMirrorEditorRef | null>(null);

  // Search store - individual selectors for React 19 compatibility
  const documentSearchOpen = useSearchStore((s) => s.documentSearchOpen);
  const openDocumentSearch = useSearchStore((s) => s.openDocumentSearch);
  const closeDocumentSearch = useSearchStore((s) => s.closeDocumentSearch);
  const globalSearchOpen = useSearchStore((s) => s.globalSearchOpen);
  const openGlobalSearch = useSearchStore((s) => s.openGlobalSearch);
  const closeGlobalSearch = useSearchStore((s) => s.closeGlobalSearch);

  // Semantic search store
  const semanticEnabled = useSemanticSearchStore((s) => s.enabled);
  const showSemanticSetup = useSemanticSearchStore((s) => s.showSetupDialog);
  const hideSemanticSetup = useSemanticSearchStore((s) => s.hideSetup);

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
  const clearAllTabs = useTabsStore((s) => s.clearAllTabs);
  const setSaveStatus = useEditorStore((s) => s.setSaveStatus);

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

  // Semantic search panel state
  const [semanticSearchOpen, setSemanticSearchOpen] = useState(false);

  // Export panel state
  const [showExport, setShowExport] = useState(false);
  const editorContentRef = useRef<HTMLDivElement | null>(null);

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

  // Initialize filesystem case sensitivity per workspace (varies by volume on macOS)
  useEffect(() => {
    if (!workspacePath) return;
    isCaseSensitiveFs(workspacePath)
      .then(setIsCaseSensitiveFs)
      .catch(() => setIsCaseSensitiveFs(false));
  }, [workspacePath, setIsCaseSensitiveFs]);

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
          const markdownContent = await readFile(persistedTab.filePath, workspacePath);
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
    // Clear ALL tabs including pinned (workspace switch)
    clearAllTabs();

    // Clear editor state
    setEditorContent("");
    setFilePath(null);
    setContent("");
    markSaved();

    // Clear backlinks index
    clearIndex();

    // Reset save indicator on workspace switch
    setSaveStatus("idle");

    // Reset tab restoration flag for new workspace
    tabsRestoredRef.current = false;
  }, [clearAllTabs, setFilePath, setContent, markSaved, clearIndex, setSaveStatus]);

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
              const content = await readFile(file.path, workspacePath);
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
        buildIndex(validFiles, workspacePath, caseSensitiveFs);
      } catch (err) {
        console.error("Failed to build backlinks index:", err);
      }
    };

    buildBacklinksIndex();
  }, [workspacePath, allFiles, buildIndex, caseSensitiveFs]);

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
      if (isDirty && filePath && activeTabId) {
        try {
          const result = await saveDocumentPipeline(activeTabId, true);
          if (!result.saved) {
            // Save failed - ask user whether to proceed
            const proceed = window.confirm(
              "Failed to save current file. Switch anyway and lose changes?"
            );
            if (!proceed) return;
          }
        } catch (error) {
          console.error("Save failed:", error);
          const proceed = window.confirm(
            "Failed to save current file. Switch anyway and lose changes?"
          );
          if (!proceed) return;
        }
      }

      try {
        // Read file content (Markdown on disk) - requires workspace path for validation
        if (!workspacePath) {
          console.error("Cannot open file: no workspace is open");
          return;
        }
        const markdownContent = await readFile(path, workspacePath);
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
    [isDirty, filePath, activeTabId, workspacePath, setFilePath, setContent, markSaved, findTabByPath, setActiveTab, openTab]
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
    async (tabId: string) => {
      // Save current file if dirty before switching
      if (isDirty && filePath && activeTabId && tabId !== activeTabId) {
        try {
          const result = await saveDocumentPipeline(activeTabId, true);
          if (!result.saved) {
            const proceed = window.confirm(
              "Failed to save current file. Switch anyway and lose changes?"
            );
            if (!proceed) return;
          }
        } catch (error) {
          console.error("Save failed:", error);
          const proceed = window.confirm(
            "Failed to save current file. Switch anyway and lose changes?"
          );
          if (!proceed) return;
        }
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
    [tabs, isDirty, filePath, activeTabId, setActiveTab, setFilePath, setContent, markSaved]
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
  const handleCloseOtherTabs = useCallback(async () => {
    if (!tabContextMenu) return;

    // Get tabs that would be closed (not the kept tab, not pinned)
    const tabsToClose = tabs.filter(
      (t) => t.id !== tabContextMenu.tabId && !t.isPinned
    );
    const dirtyTabs = tabsToClose.filter((t) => t.isDirty);

    if (dirtyTabs.length > 0) {
      // Batch prompt: Save All or Cancel (no Discard All in Phase 1)
      const message = `${dirtyTabs.length} file(s) have unsaved changes.\n\n` +
        `Click "OK" to save all and close\n` +
        `Click "Cancel" to abort`;

      const shouldSave = window.confirm(message);

      if (shouldSave) {
        // Try to save all dirty tabs
        const failedSaves: string[] = [];
        for (const tab of dirtyTabs) {
          try {
            await saveDocumentPipeline(tab.id, tab.id === activeTabId);
          } catch {
            failedSaves.push(tab.displayName);
          }
        }

        // If any saves failed, abort and keep context menu open
        if (failedSaves.length > 0) {
          window.alert(
            `Failed to save: ${failedSaves.join(", ")}\n\nOperation aborted. No tabs were closed.`
          );
          return;  // Keep context menu open so user can retry or investigate
        }
      } else {
        // User chose Cancel - abort entirely
        setTabContextMenu(null);
        return;
      }
    }

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

    setTabContextMenu(null);  // Dismiss on success
  }, [tabContextMenu, tabs, activeTabId, closeOtherTabs, setFilePath, setContent, markSaved]);

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

      // Cmd/Ctrl + F: Find in document (CodeMirror built-in search)
      if (isMod && e.key === "f" && !e.shiftKey) {
        e.preventDefault();
        if (filePath) {
          openDocumentSearch();
          editorRef.current?.openSearch();
        }
      }

      // Cmd/Ctrl + Shift + F: Global search
      if (isMod && e.key === "f" && e.shiftKey) {
        e.preventDefault();
        if (workspacePath) {
          openGlobalSearch();
        }
      }

      // Cmd/Ctrl + Shift + Space: Semantic search
      if (isMod && e.key === " " && e.shiftKey) {
        e.preventDefault();
        if (semanticEnabled) {
          setSemanticSearchOpen((prev) => !prev);
        }
      }

      // Escape: Close search panels
      if (e.key === "Escape") {
        if (semanticSearchOpen) {
          e.preventDefault();
          setSemanticSearchOpen(false);
        } else if (documentSearchOpen) {
          e.preventDefault();
          closeDocumentSearch();
          editorRef.current?.closeSearch();
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
    semanticSearchOpen,
    semanticEnabled,
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

      // Case-insensitive check to avoid creating Note.MD.md
      const fileName = name.toLowerCase().endsWith(".md") ? name : `${name}.md`;
      // Use async joinFsPaths for UNC path support on Windows
      const newPath = await joinFsPaths(parentPath, fileName);

      try {
        if (!workspacePath) {
          alert("Cannot create file: no workspace is open");
          return;
        }
        await createFile(newPath, workspacePath);
        // Reload workspace to show new file
        await loadWorkspace(workspacePath);
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

      // Use async joinFsPaths for UNC path support on Windows
      const newPath = await joinFsPaths(parentPath, name);

      try {
        if (!workspacePath) {
          alert("Cannot create folder: no workspace is open");
          return;
        }
        await createFolder(newPath, workspacePath);
        await loadWorkspace(workspacePath);
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

      // Use async path utilities for UNC path support on Windows
      const parentPath = await getParentPath(path);
      const newPath = await joinFsPaths(parentPath, newName);

      try {
        // Get files that link to this file (only for .md files, case-insensitive)
        const isMarkdown = path.toLowerCase().endsWith(".md");
        const backlinks = isMarkdown
          ? useLinksStore.getState().getBacklinks(path)
          : [];

        if (backlinks.length > 0 && workspacePath) {
          // Update links in affected files, then rename
          const { errors } = await renameFileWithLinkUpdates(
            path,
            newPath,
            workspacePath,
            backlinks,
            caseSensitiveFs
          );

          if (errors.length > 0) {
            console.warn("Some link updates failed:", errors);
          }
        } else if (workspacePath) {
          // No backlinks, just rename
          await renamePath(path, newPath, workspacePath);
        } else {
          alert("Cannot rename: no workspace is open");
          return;
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
        if (!workspacePath) {
          alert("Cannot delete: no workspace is open");
          return;
        }
        const result = await deletePath(path, workspacePath);

        // Show warning if trash failed and file was permanently deleted
        if (result.warning) {
          console.warn(result.warning);
          alert(result.warning);
        }

        await loadWorkspace(workspacePath);
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
      const newPath = await calculateNewPath(sourcePath, targetFolderPath);

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
          backlinks,
          caseSensitiveFs
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
    [workspacePath, loadWorkspace, filePath, setFilePath, caseSensitiveFs]
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
      if (workspacePath && !isWithinWorkspace(intendedPath, workspacePath, caseSensitiveFs)) {
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
    <div className={cn(
      "flex h-screen overflow-hidden bg-[var(--color-paper)]",
      zenMode && "zen-mode"
    )}>
      {/* Sidebar Container with Resize Handle */}
      <div
        className={cn(
          "flex flex-shrink-0 relative",
          (!sidebarOpen || zenMode) && "sidebar-collapsed"
        )}
        style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
      >
        <aside className={cn(
          "flex flex-col flex-shrink-0 bg-[var(--color-paper-warm)] border-r border-[var(--color-border)] overflow-y-auto overflow-x-hidden",
          sidebarOpen && !zenMode ? "w-[var(--sidebar-width,260px)]" : "w-0"
        )}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] m-0 whitespace-nowrap overflow-hidden text-ellipsis">
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
          <div className="flex gap-1">
            <button
              className="flex items-center justify-center w-7 h-7 p-0 border-none rounded bg-transparent text-[var(--color-ink-muted)] cursor-pointer transition-all duration-150 hover:bg-[var(--color-border)] hover:text-[var(--color-ink)]"
              onClick={() => workspacePath && handleCreateFile(workspacePath)}
              title="New file"
              disabled={!workspacePath}
            >
              <FilePlus className="h-4 w-4" />
            </button>
            <button
              className="flex items-center justify-center w-7 h-7 p-0 border-none rounded bg-transparent text-[var(--color-ink-muted)] cursor-pointer transition-all duration-150 hover:bg-[var(--color-border)] hover:text-[var(--color-ink)]"
              onClick={handleOpenFolder}
              title="Open folder"
            >
              <FolderOpen className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sidebar Tabs */}
        <div className="flex gap-0 px-3 border-b border-[var(--color-border)] bg-[var(--color-paper-warm)]">
          <button
            className={cn(
              "sidebar-tab relative flex items-center gap-1.5 px-3 py-2.5 border-none bg-transparent text-[var(--color-ink-muted)] font-sans text-[0.6875rem] font-semibold uppercase tracking-wider cursor-pointer transition-colors duration-150 hover:text-[var(--color-ink-light)]",
              activeSidebarTab === "files" && "text-[var(--color-ink)] after:content-[''] after:absolute after:bottom-[-1px] after:left-3 after:right-3 after:h-0.5 after:bg-[var(--color-accent)] after:rounded-t-sm"
            )}
            onClick={() => setActiveSidebarTab("files")}
          >
            <Folder className="h-3.5 w-3.5" />
            <span>Files</span>
          </button>
          <button
            className={cn(
              "sidebar-tab relative flex items-center gap-1.5 px-3 py-2.5 border-none bg-transparent text-[var(--color-ink-muted)] font-sans text-[0.6875rem] font-semibold uppercase tracking-wider cursor-pointer transition-colors duration-150 hover:text-[var(--color-ink-light)]",
              activeSidebarTab === "outline" && "text-[var(--color-ink)] after:content-[''] after:absolute after:bottom-[-1px] after:left-3 after:right-3 after:h-0.5 after:bg-[var(--color-accent)] after:rounded-t-sm"
            )}
            onClick={() => setActiveSidebarTab("outline")}
            disabled={!filePath}
            title={!filePath ? "Open a file to see outline" : undefined}
          >
            <List className="h-3.5 w-3.5" />
            <span>Outline</span>
          </button>
          <button
            className={cn(
              "sidebar-tab relative flex items-center gap-1.5 px-3 py-2.5 border-none bg-transparent text-[var(--color-ink-muted)] font-sans text-[0.6875rem] font-semibold uppercase tracking-wider cursor-pointer transition-colors duration-150 hover:text-[var(--color-ink-light)]",
              activeSidebarTab === "backlinks" && "text-[var(--color-ink)] after:content-[''] after:absolute after:bottom-[-1px] after:left-3 after:right-3 after:h-0.5 after:bg-[var(--color-accent)] after:rounded-t-sm"
            )}
            onClick={() => setActiveSidebarTab("backlinks")}
            disabled={!filePath}
            title={!filePath ? "Open a file to see backlinks" : undefined}
          >
            <Link className="h-3.5 w-3.5" />
            <span>Links</span>
          </button>
          {semanticEnabled && (
            <button
              className={cn(
                "sidebar-tab relative flex items-center gap-1.5 px-3 py-2.5 border-none bg-transparent text-[var(--color-ink-muted)] font-sans text-[0.6875rem] font-semibold uppercase tracking-wider cursor-pointer transition-colors duration-150 hover:text-[var(--color-ink-light)]",
                activeSidebarTab === "related" && "text-[var(--color-ink)] after:content-[''] after:absolute after:bottom-[-1px] after:left-3 after:right-3 after:h-0.5 after:bg-[var(--color-accent)] after:rounded-t-sm"
              )}
              onClick={() => setActiveSidebarTab("related")}
              disabled={!filePath}
              title={!filePath ? "Open a file to see related documents" : undefined}
            >
              <RelatedDocsTabIcon />
              <span>Related</span>
            </button>
          )}
        </div>

        {/* Tab Content */}
        {activeSidebarTab === "files" && (
          <>
            {!workspacePath ? (
              <button
                className="flex items-center justify-center gap-2 w-[calc(100%-2rem)] mx-4 my-4 px-4 py-3 border border-dashed border-[var(--color-border-strong)] rounded-lg bg-transparent text-[var(--color-ink-muted)] font-sans text-[0.8125rem] cursor-pointer transition-all duration-150 hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] hover:bg-[rgba(196,93,62,0.05)]"
                onClick={handleOpenFolder}
              >
                <FolderOpen className="h-4 w-4" />
                <span>Open Folder</span>
              </button>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-[var(--color-ink-muted)] font-sans">
                <p>Loading...</p>
              </div>
            ) : (
              <>
                <div className="flex justify-end px-3 py-2 border-b border-[var(--color-border)]">
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
        {activeSidebarTab === "related" && semanticEnabled && (
          <RelatedDocumentsPanel
            filePath={filePath}
            onDocumentClick={handleFileSelect}
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
      <main className={cn(
        "flex-1 overflow-y-auto min-w-0",
        zenMode && "flex flex-col"
      )} ref={mainContentRef}>
        {/* Title bar */}
        <div className={cn(
          "flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-paper)]",
          zenMode && "title-bar-zen opacity-0 transition-opacity duration-200 absolute top-0 left-0 right-0 z-[100] hover:opacity-100 focus-within:opacity-100"
        )} style={zenMode ? { background: 'linear-gradient(to bottom, var(--color-paper) 0%, var(--color-paper) 60%, transparent 100%)', paddingBottom: '1rem' } : undefined}>
          <div className="flex items-center gap-3">
            <button
              className="flex items-center justify-center w-8 h-8 p-0 border-none rounded bg-transparent text-[var(--color-ink-muted)] cursor-pointer transition-all duration-150 hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
              onClick={handleToggleSidebar}
              title={sidebarOpen ? "Hide sidebar (⌘B)" : "Show sidebar (⌘B)"}
            >
              <PanelLeft className="h-5 w-5" />
            </button>
            <span className="font-sans text-sm text-[var(--color-ink-light)]">
              {filePath ? getFileName(filePath) : "Untitled"}
              {isDirty && <span className="text-[var(--color-accent)] ml-1">•</span>}
            </span>
            <SaveIndicator />
          </div>
          <div className="flex items-center gap-1">
            {filePath && (
              <button
                className="flex items-center justify-center w-8 h-8 p-0 border-none rounded bg-transparent text-[var(--color-ink-muted)] cursor-pointer transition-all duration-150 hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
                onClick={() => setShowExport(true)}
                title="Export"
              >
                <Upload className="h-4 w-4" />
              </button>
            )}
            <button
              className="flex items-center justify-center w-8 h-8 p-0 border-none rounded bg-transparent text-[var(--color-ink-muted)] cursor-pointer transition-all duration-150 hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
              onClick={() => setShowSettings(true)}
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              className={cn(
                "flex items-center justify-center w-8 h-8 p-0 border-none rounded bg-transparent text-[var(--color-ink-muted)] cursor-pointer transition-all duration-150 hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]",
                zenMode && "text-[var(--color-accent)] bg-[var(--color-accent-soft)]"
              )}
              onClick={toggleZenMode}
              title={zenMode ? "Exit zen mode (Esc)" : "Zen mode"}
            >
              <Maximize className="h-4 w-4" />
            </button>
            {filePath && workspacePath && (
              <button
                className="flex items-center justify-center w-8 h-8 p-0 border-none rounded bg-transparent text-[var(--color-ink-muted)] cursor-pointer transition-all duration-150 hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
                onClick={() => setShowHistory(!showHistory)}
                title="Version history"
              >
                <Clock className="h-4 w-4" />
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
          <div className={cn(
            "editor-wrapper",
            zenMode && "flex-1 flex justify-center pt-8"
          )} ref={editorContentRef}>
            {/* CodeMirror Editor - has built-in search panel (Cmd/Ctrl+F) */}
            <CodeMirrorEditor
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

      {/* Semantic Search Panel */}
      {semanticSearchOpen && semanticEnabled && (
        <SemanticSearchPanel
          onResultClick={(resultPath) => {
            handleFileSelect(resultPath);
            setSemanticSearchOpen(false);
          }}
          onClose={() => setSemanticSearchOpen(false)}
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
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Export Panel */}
      <ExportPanel
        isOpen={showExport && !!filePath}
        contentRef={editorContentRef}
        filename={filePath ? getFileName(filePath) : ""}
        onClose={() => setShowExport(false)}
      />

      {/* Semantic Search Setup Dialog */}
      {showSemanticSetup && (
        <SemanticSetupDialog
          onComplete={async (enabled, folders) => {
            if (enabled && folders.length > 0) {
              // Add folders and enable semantic search
              const store = useSemanticSearchStore.getState();
              for (const folder of folders) {
                await store.addFolder(folder.path, folder.name);
              }
              // Initialize the model
              await store.initializeModel();
              // Index the folders
              for (const folder of folders) {
                await indexFolder(folder.path);
              }
            }
            hideSemanticSetup();
          }}
          onCancel={hideSemanticSetup}
        />
      )}
    </div>
  );
}

// Custom Icons - kept for unique designs without Lucide equivalents

function RelatedDocsTabIcon() {
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
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

export default App;
