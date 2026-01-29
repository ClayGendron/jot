import { useCallback, useEffect, useState } from "react";
import { Editor } from "@/components/editor/Editor";
import { FileTree } from "@/components/sidebar/FileTree";
import { useEditorStore } from "@/stores/editorStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import {
  readDirectory,
  readFile,
  writeFile,
  createFile,
  createFolder,
  renamePath,
  deletePath,
  openFolderDialog,
  joinPath,
  getFileName,
} from "@/lib/tauri/files";
import "./index.css";

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

  // Open file
  const handleFileSelect = useCallback(
    async (path: string) => {
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
    [setFilePath, setContent, markSaved]
  );

  // Save file
  const handleSave = useCallback(async () => {
    if (!filePath) return;

    try {
      await writeFile(filePath, editorContent);
      markSaved();
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  }, [filePath, editorContent, markSaved]);

  // Auto-save on content change (debounced in editor)
  const handleEditorUpdate = useCallback(
    (content: string) => {
      setEditorContent(content);
    },
    []
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

      const parentPath = path.substring(0, path.lastIndexOf("/"));
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

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-title">
            {workspacePath ? getFileName(workspacePath) : "Files"}
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
      </aside>

      {/* Main Content */}
      <main className="main-content">
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
          </div>
        </div>

        {/* Editor */}
        {filePath ? (
          <Editor
            initialContent={editorContent}
            onUpdate={handleEditorUpdate}
            placeholder="Start writing..."
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

export default App;
