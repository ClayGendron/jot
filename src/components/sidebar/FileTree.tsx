import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useEditorStore } from "@/stores/editorStore";
import { readFolderChildren, type FileEntry } from "@/lib/tauri/files";
import { validateMove } from "@/lib/links/moveFile";
import { sortFileEntries } from "@/lib/files/sortFiles";
import { normalizeForDisplay } from "@/lib/path/pathUtils";

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  onSelect: (path: string) => void;
  onToggle: (path: string, entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onDragStart: (e: React.DragEvent, entry: FileEntry) => void;
  onDragOver: (e: React.DragEvent, entry: FileEntry) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetEntry: FileEntry) => void;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  loadingPaths: Set<string>;
  dragOverPath: string | null;
  isDragValid: boolean;
}

function FileTreeItem({
  entry,
  depth,
  onSelect,
  onToggle,
  onContextMenu,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  selectedPath,
  expandedPaths,
  loadingPaths,
  dragOverPath,
  isDragValid,
}: FileTreeItemProps) {
  const isExpanded = expandedPaths.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const isDragOver = dragOverPath === entry.path;
  const isLoading = loadingPaths.has(entry.path);

  const handleClick = useCallback(() => {
    if (entry.is_dir) {
      onToggle(entry.path, entry);
    } else {
      onSelect(entry.path);
    }
  }, [entry, onSelect, onToggle]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onContextMenu(e, entry);
    },
    [entry, onContextMenu]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      onDragStart(e, entry);
    },
    [entry, onDragStart]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      onDragOver(e, entry);
    },
    [entry, onDragOver]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      onDrop(e, entry);
    },
    [entry, onDrop]
  );

  // Build class names for drag states
  let dragClass = "";
  if (isDragOver) {
    dragClass = isDragValid ? "drag-over-valid" : "drag-over-invalid";
  }

  return (
    <div className="file-tree-item-container">
      <button
        type="button"
        className={`file-tree-item ${isSelected ? "selected" : ""} ${dragClass}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={onDragLeave}
        onDrop={handleDrop}
        data-testid={`file-tree-item-${entry.name}`}
      >
        {/* Expand/collapse chevron for folders */}
        <span className="file-tree-chevron">
          {entry.is_dir ? (
            <ChevronIcon expanded={isExpanded} />
          ) : (
            <span style={{ width: 16 }} />
          )}
        </span>

        {/* File/folder icon */}
        <span className="file-tree-icon">
          {entry.is_dir ? (
            <FolderIcon open={isExpanded} />
          ) : (
            <FileIcon />
          )}
        </span>

        {/* Name */}
        <span className="file-tree-name">{entry.name}</span>
      </button>

      {/* Children */}
      {entry.is_dir && isExpanded && (
        <div className="file-tree-children">
          {isLoading ? (
            <div
              className="file-tree-loading"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              Loading...
            </div>
          ) : entry.children && entry.children.length === 0 ? (
            <div
              className="file-tree-empty"
              style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}
            >
              Empty folder
            </div>
          ) : (
            entry.children?.map((child) => (
              <FileTreeItem
                key={child.path}
                entry={child}
                depth={depth + 1}
                onSelect={onSelect}
                onToggle={onToggle}
                onContextMenu={onContextMenu}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                loadingPaths={loadingPaths}
                dragOverPath={dragOverPath}
                isDragValid={isDragValid}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface FileTreeProps {
  onFileSelect: (path: string) => void;
  onCreateFile?: (parentPath: string) => void;
  onCreateFolder?: (parentPath: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  onMove?: (sourcePath: string, targetFolderPath: string) => void;
}

export function FileTree({
  onFileSelect,
  onCreateFile,
  onCreateFolder,
  onRename,
  onDelete,
  onMove,
}: FileTreeProps) {
  // Use individual selectors to avoid React 19 + Zustand issues
  const fileTree = useWorkspaceStore((state) => state.fileTree);
  const selectedPath = useWorkspaceStore((state) => state.selectedPath);
  const expandedPaths = useWorkspaceStore((state) => state.expandedPaths);
  const loadingPaths = useWorkspaceStore((state) => state.loadingPaths);
  const setSelectedPath = useWorkspaceStore((state) => state.setSelectedPath);
  const toggleExpanded = useWorkspaceStore((state) => state.toggleExpanded);
  const loadFolderChildren = useWorkspaceStore((state) => state.loadFolderChildren);
  const setPathLoading = useWorkspaceStore((state) => state.setPathLoading);
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const sortBy = useWorkspaceStore((state) => state.sortBy);
  const sortDirection = useWorkspaceStore((state) => state.sortDirection);
  const caseSensitiveFs = useEditorStore((state) => state.isCaseSensitiveFs);

  // Compute sorted file tree (memoized to avoid unnecessary re-sorts)
  const sortedFileTree = useMemo(
    () => sortFileEntries(fileTree, sortBy, sortDirection),
    [fileTree, sortBy, sortDirection]
  );

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entry: FileEntry | null;
  } | null>(null);

  // Drag-drop state
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [isDragValid, setIsDragValid] = useState(false);

  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (path: string) => {
      setSelectedPath(path);
      onFileSelect(path);
    },
    [setSelectedPath, onFileSelect]
  );

  // Handle folder toggle with lazy loading
  const handleToggle = useCallback(
    async (path: string, entry: FileEntry) => {
      const isExpanded = expandedPaths.has(path);

      // If collapsing, just toggle
      if (isExpanded) {
        toggleExpanded(path);
        return;
      }

      // If expanding and folder needs lazy load (empty children, not already loading)
      const needsLoad =
        entry.is_dir &&
        entry.children !== null &&
        entry.children.length === 0 &&
        !loadingPaths.has(path);

      if (needsLoad) {
        setPathLoading(path, true);
        try {
          const children = await readFolderChildren(path);
          loadFolderChildren(path, children);
        } catch (error) {
          console.error("Failed to load folder children:", error);
          setPathLoading(path, false);
        }
      }

      toggleExpanded(path);
    },
    [expandedPaths, loadingPaths, toggleExpanded, loadFolderChildren, setPathLoading]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, entry: FileEntry) => {
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        entry,
      });
    },
    []
  );

  const handleCreateFile = useCallback(() => {
    if (contextMenu?.entry) {
      const parentPath = contextMenu.entry.is_dir
        ? contextMenu.entry.path
        : workspacePath;
      if (parentPath) {
        onCreateFile?.(parentPath);
      }
    }
    setContextMenu(null);
  }, [contextMenu, workspacePath, onCreateFile]);

  const handleCreateFolder = useCallback(() => {
    if (contextMenu?.entry) {
      const parentPath = contextMenu.entry.is_dir
        ? contextMenu.entry.path
        : workspacePath;
      if (parentPath) {
        onCreateFolder?.(parentPath);
      }
    }
    setContextMenu(null);
  }, [contextMenu, workspacePath, onCreateFolder]);

  const handleRename = useCallback(() => {
    if (contextMenu?.entry) {
      onRename?.(contextMenu.entry.path);
    }
    setContextMenu(null);
  }, [contextMenu, onRename]);

  const handleDelete = useCallback(() => {
    if (contextMenu?.entry) {
      onDelete?.(contextMenu.entry.path);
    }
    setContextMenu(null);
  }, [contextMenu, onDelete]);

  // Drag-drop handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent, entry: FileEntry) => {
      setDraggedPath(entry.path);
      e.dataTransfer.setData("text/plain", entry.path);
      e.dataTransfer.effectAllowed = "move";

      // Add a slight delay for visual feedback
      const target = e.target as HTMLElement;
      setTimeout(() => {
        target.classList.add("dragging");
      }, 0);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, entry: FileEntry) => {
      e.preventDefault();

      if (!draggedPath || !workspacePath) return;

      // Determine target folder (if dropping on file, use its parent)
      // Normalize path for cross-platform consistency (Windows backslashes → forward slashes)
      const targetFolder = entry.is_dir
        ? entry.path
        : normalizeForDisplay(entry.path).split("/").slice(0, -1).join("/");

      // Validate the move
      const validation = validateMove(draggedPath, targetFolder, workspacePath, caseSensitiveFs);

      setDragOverPath(entry.path);
      setIsDragValid(validation.valid);

      // Set cursor feedback
      e.dataTransfer.dropEffect = validation.valid ? "move" : "none";
    },
    [draggedPath, workspacePath, caseSensitiveFs]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the element (not entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;

    if (!currentTarget.contains(relatedTarget)) {
      setDragOverPath(null);
      setIsDragValid(false);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedPath(null);
    setDragOverPath(null);
    setIsDragValid(false);

    // Remove dragging class from all items
    document.querySelectorAll(".dragging").forEach((el) => {
      el.classList.remove("dragging");
    });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetEntry: FileEntry) => {
      e.preventDefault();

      if (!draggedPath || !workspacePath || !onMove) {
        handleDragEnd();
        return;
      }

      // Determine target folder
      // Normalize path for cross-platform consistency (Windows backslashes → forward slashes)
      const targetFolder = targetEntry.is_dir
        ? targetEntry.path
        : normalizeForDisplay(targetEntry.path).split("/").slice(0, -1).join("/");

      // Validate one more time before executing
      const validation = validateMove(draggedPath, targetFolder, workspacePath, caseSensitiveFs);

      if (validation.valid) {
        onMove(draggedPath, targetFolder);
      }

      handleDragEnd();
    },
    [draggedPath, workspacePath, onMove, handleDragEnd, caseSensitiveFs]
  );

  // Handle drops on the root file tree area (workspace root)
  const handleRootDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      if (!draggedPath || !workspacePath) return;

      const validation = validateMove(draggedPath, workspacePath, workspacePath, caseSensitiveFs);
      setIsDragValid(validation.valid);
      e.dataTransfer.dropEffect = validation.valid ? "move" : "none";
    },
    [draggedPath, workspacePath, caseSensitiveFs]
  );

  const handleRootDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();

      if (!draggedPath || !workspacePath || !onMove) {
        handleDragEnd();
        return;
      }

      const validation = validateMove(draggedPath, workspacePath, workspacePath, caseSensitiveFs);

      if (validation.valid) {
        onMove(draggedPath, workspacePath);
      }

      handleDragEnd();
    },
    [draggedPath, workspacePath, onMove, handleDragEnd, caseSensitiveFs]
  );

  if (fileTree.length === 0) {
    return (
      <div className="file-tree-empty-state">
        <p>No files yet</p>
        <p className="file-tree-hint">
          Create a new file or open a folder
        </p>
      </div>
    );
  }

  return (
    <div
      className="file-tree"
      data-testid="file-tree"
      onDragOver={handleRootDragOver}
      onDrop={handleRootDrop}
      onDragEnd={handleDragEnd}
    >
      {sortedFileTree.map((entry) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          depth={0}
          onSelect={handleSelect}
          onToggle={handleToggle}
          onContextMenu={handleContextMenu}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          selectedPath={selectedPath}
          expandedPaths={expandedPaths}
          loadingPaths={loadingPaths}
          dragOverPath={dragOverPath}
          isDragValid={isDragValid}
        />
      ))}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="file-tree-context-menu"
          style={{
            top: contextMenu.y,
            left: contextMenu.x,
          }}
        >
          <button onClick={handleCreateFile}>New File</button>
          <button onClick={handleCreateFolder}>New Folder</button>
          <div className="context-menu-divider" />
          <button onClick={handleRename}>Rename</button>
          <button onClick={handleDelete} className="danger">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// Icons

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className={`chevron-icon ${expanded ? "expanded" : ""}`}
    >
      <path
        d="M6 4L10 8L6 12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M2 4.5C2 3.67 2.67 3 3.5 3H6L7.5 4.5H12.5C13.33 4.5 14 5.17 14 6V6.5H3.5L2 12V4.5Z"
          fill="currentColor"
          opacity="0.2"
        />
        <path
          d="M2.5 12L4 6.5H14.5L13 12H2.5Z"
          fill="currentColor"
          opacity="0.3"
        />
        <path
          d="M2 4.5C2 3.67 2.67 3 3.5 3H6L7.5 4.5H12.5C13.33 4.5 14 5.17 14 6V6.5M2 4.5V12L3.5 6.5H14.5L13 12H2.5M2 4.5L3.5 6.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 4.5C2 3.67 2.67 3 3.5 3H6L7.5 4.5H12.5C13.33 4.5 14 5.17 14 6V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M2 4.5C2 3.67 2.67 3 3.5 3H6L7.5 4.5H12.5C13.33 4.5 14 5.17 14 6V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 2H9L12 5V13C12 13.55 11.55 14 11 14H4C3.45 14 3 13.55 3 13V3C3 2.45 3.45 2 4 2Z"
        fill="currentColor"
        opacity="0.1"
      />
      <path
        d="M9 2L12 5H10C9.45 5 9 4.55 9 4V2Z"
        fill="currentColor"
        opacity="0.2"
      />
      <path
        d="M4 2H9L12 5V13C12 13.55 11.55 14 11 14H4C3.45 14 3 13.55 3 13V3C3 2.45 3.45 2 4 2Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 2V4C9 4.55 9.45 5 10 5H12"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default FileTree;
