import { useCallback, useEffect, useState, useRef, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { Editor } from "@/components/editor/Editor";
import {
  FileTree,
  DocumentOutline,
  BacklinksPanel,
  SortDropdown,
} from "@/components/sidebar";
import { SaveIndicator } from "@/components/ui/SaveIndicator";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useLinksStore } from "@/stores/linksStore";
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
import "./index.css";

type SidebarTab = "files" | "outline" | "backlinks";

/**
 * Main application component
 */
function App() {
  // Use individual selectors to avoid React 19 + Zustand issues
  const sidebarOpen = useEditorStore((state) => state.sidebarOpen);
  const toggleSidebar = useEditorStore((state) => state.toggleSidebar);
  const isDirty = useEditorStore((state) => state.isDirty);
  const filePath = useEditorStore((state) => state.filePath);
  const setFilePath = useEditorStore((state) => state.setFilePath);
  const setContent = useEditorStore((state) => state.setContent);
  const markSaved = useEditorStore((state) => state.markSaved);

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
  const { buildIndex, backlinksIndex } = useLinksStore(
    useShallow((state) => ({ buildIndex: state.buildIndex, backlinksIndex: state.backlinksIndex }))
  );
  const backlinks = useMemo(
    () => (filePath ? getBacklinksForFile(backlinksIndex, filePath) : []),
    [backlinksIndex, filePath]
  );

  const [editorContent, setEditorContent] = useState("");
  const [activeTab, setActiveTab] = useState<SidebarTab>("files");
  const mainContentRef = useRef<HTMLElement | null>(null);

  // Document outline hook
  const { headings, activeHeadingId, scrollToHeading } = useDocumentOutline({
    content: editorContent,
    scrollContainerRef: mainContentRef,
  });

  // Autosave hook
  const { saveNow, checkCrashRecovery, recoverFromCrash } =
    useAutosave(editorContent);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workspace");
        console.error("Failed to load workspace:", err);
      } finally {
        setLoading(false);
      }
    },
    [storeLoadWorkspace, setLoading, setError]
  );

  // Open folder dialog
  const handleOpenFolder = useCallback(async () => {
    try {
      const path = await openFolderDialog();
      if (path) {
        await loadWorkspace(path);
      }
    } catch (err) {
      console.error("Failed to open folder:", err);
    }
  }, [loadWorkspace]);

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

  // Open file - saves current file first if dirty
  const handleFileSelect = useCallback(
    async (path: string) => {
      // Save current file if it has unsaved changes
      if (isDirty && filePath) {
        saveNow();
      }

      try {
        // Read file content (Markdown on disk)
        const markdownContent = await readFile(path);
        // Convert Markdown to HTML for TipTap editor
        const htmlContent = markdownToHtml(markdownContent);
        setEditorContent(htmlContent);
        setFilePath(path);
        setContent(htmlContent);
        markSaved();
      } catch (err) {
        console.error("Failed to open file:", err);
      }
    },
    [isDirty, filePath, saveNow, setFilePath, setContent, markSaved]
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
    },
    [setContent]
  );

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
      if (isMod && e.key === "o") {
        e.preventDefault();
        handleOpenFolder();
      }

      // Cmd/Ctrl + B: Toggle sidebar
      if (isMod && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleOpenFolder, toggleSidebar]);

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
      } catch (err) {
        console.error("Failed to rename:", err);
        alert(err instanceof Error ? err.message : "Failed to rename");
      }
    },
    [workspacePath, loadWorkspace, filePath, setFilePath]
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

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-title">
            {workspacePath ? getFileName(workspacePath) : "Jot"}
          </h2>
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
            className={`sidebar-tab ${activeTab === "files" ? "active" : ""}`}
            onClick={() => setActiveTab("files")}
          >
            <FilesTabIcon />
            <span>Files</span>
          </button>
          <button
            className={`sidebar-tab ${activeTab === "outline" ? "active" : ""}`}
            onClick={() => setActiveTab("outline")}
            disabled={!filePath}
            title={!filePath ? "Open a file to see outline" : undefined}
          >
            <OutlineTabIcon />
            <span>Outline</span>
          </button>
          <button
            className={`sidebar-tab ${activeTab === "backlinks" ? "active" : ""}`}
            onClick={() => setActiveTab("backlinks")}
            disabled={!filePath}
            title={!filePath ? "Open a file to see backlinks" : undefined}
          >
            <BacklinksTabIcon />
            <span>Links</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "files" && (
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
        {activeTab === "outline" && (
          <DocumentOutline
            headings={headings}
            activeHeadingId={activeHeadingId}
            onHeadingClick={scrollToHeading}
          />
        )}
        {activeTab === "backlinks" && (
          <BacklinksPanel
            backlinks={backlinks}
            onBacklinkClick={handleFileSelect}
          />
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content" ref={mainContentRef}>
        {/* Title bar */}
        <div className="title-bar">
          <div className="title-bar-left">
            <button
              className="sidebar-toggle-btn"
              onClick={toggleSidebar}
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
        </div>

        {/* Editor */}
        {filePath ? (
          <Editor
            initialContent={editorContent}
            onUpdate={handleEditorUpdate}
            placeholder="Start writing..."
            onInternalLinkClick={handleInternalLinkClick}
            onScrollToHeading={handleScrollToHeading}
            onBrokenLinkClick={handleBrokenLinkClick}
          />
        ) : (
          <div className="empty-state">
            <div className="empty-state-content">
              <h2>Welcome to Jot</h2>
              <p>Open a folder or create a new file to get started.</p>
              <div className="empty-state-actions">
                <button onClick={handleOpenFolder}>
                  <FolderOpenIcon />
                  Open Folder
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
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

export default App;
