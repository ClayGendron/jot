import { useCallback, useEffect, useState, useRef } from "react";
import { Editor } from "@/components/editor/Editor";
import { FileTree, DocumentOutline } from "@/components/sidebar";
import { SaveIndicator } from "@/components/ui/SaveIndicator";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
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
} from "@/lib/tauri/files";
import "./index.css";

type SidebarTab = "files" | "outline";

/**
 * Main application component
 */
function App() {
  const { sidebarOpen, toggleSidebar, isDirty, filePath, setFilePath, setContent, markSaved } =
    useEditorStore();
  const {
    workspacePath,
    setWorkspacePath,
    setFileTree,
    setLoading,
    setError,
    isLoading,
  } = useWorkspaceStore();

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
        setFileTree(entries);
        setWorkspacePath(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workspace");
        console.error("Failed to load workspace:", err);
      } finally {
        setLoading(false);
      }
    },
    [setFileTree, setWorkspacePath, setLoading, setError]
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

  // Open file - saves current file first if dirty
  const handleFileSelect = useCallback(
    async (path: string) => {
      // Save current file if it has unsaved changes
      if (isDirty && filePath) {
        saveNow();
      }

      try {
        const content = await readFile(path);
        setEditorContent(content);
        setFilePath(path);
        setContent(content);
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

  // Rename file/folder
  const handleRename = useCallback(
    async (path: string) => {
      const currentName = getFileName(path);
      const newName = window.prompt("New name:", currentName);
      if (!newName || newName === currentName) return;

      const parentPath = getParentDir(path);
      const newPath = joinPath(parentPath, newName);

      try {
        await renamePath(path, newPath);
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

  // Handle internal link click - navigate to file and optionally scroll to heading
  const pendingHeadingRef = useRef<string | undefined>(undefined);

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
        </div>

        {/* Tab Content */}
        {activeTab === "files" ? (
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
              <FileTree
                onFileSelect={handleFileSelect}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            )}
          </>
        ) : (
          <DocumentOutline
            headings={headings}
            activeHeadingId={activeHeadingId}
            onHeadingClick={scrollToHeading}
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

export default App;
