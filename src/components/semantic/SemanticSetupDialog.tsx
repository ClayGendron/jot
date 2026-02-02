/**
 * SemanticSetupDialog Component
 *
 * First-time setup dialog for semantic search.
 * Allows users to enable semantic search and select folders to index.
 */

import { useState, useCallback } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";

interface SemanticSetupDialogProps {
  onComplete: (enabled: boolean, folders: { path: string; name: string }[]) => void;
  onCancel: () => void;
}

interface FolderEntry {
  path: string;
  name: string;
}

export function SemanticSetupDialog({
  onComplete,
  onCancel,
}: SemanticSetupDialogProps) {
  const [folders, setFolders] = useState<FolderEntry[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);

  // Add a folder via dialog
  const handleAddFolder = useCallback(async () => {
    setIsSelecting(true);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: "Select folder to index",
      });

      if (selected && typeof selected === "string") {
        // Check if already added
        if (folders.some((f) => f.path === selected)) {
          return;
        }

        // Get folder name from path
        const name = selected.split(/[/\\]/).pop() || selected;
        setFolders((prev) => [...prev, { path: selected, name }]);
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
    } finally {
      setIsSelecting(false);
    }
  }, [folders]);

  // Quick add Documents folder
  const handleAddDocuments = useCallback(async () => {
    try {
      const home = await homeDir();
      const documentsPath = `${home}Documents`;

      // Check if already added
      if (folders.some((f) => f.path === documentsPath)) {
        return;
      }

      setFolders((prev) => [...prev, { path: documentsPath, name: "Documents" }]);
    } catch (err) {
      console.error("Failed to get Documents path:", err);
    }
  }, [folders]);

  // Remove a folder
  const handleRemoveFolder = useCallback((path: string) => {
    setFolders((prev) => prev.filter((f) => f.path !== path));
  }, []);

  // Enable semantic search
  const handleEnable = useCallback(() => {
    if (folders.length === 0) {
      // Prompt to add at least one folder
      return;
    }
    onComplete(true, folders);
  }, [folders, onComplete]);

  // Skip setup
  const handleSkip = useCallback(() => {
    onCancel();
  }, [onCancel]);

  return (
    <div className="semantic-setup-overlay" onClick={handleSkip}>
      <div
        className="semantic-setup-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="semantic-setup-title"
        aria-describedby="semantic-setup-description"
      >
        {/* Header */}
        <div className="semantic-setup-header">
          <div className="semantic-setup-icon">
            <BrainIcon />
          </div>
          <h2 id="semantic-setup-title" className="semantic-setup-title">
            Semantic Search
          </h2>
          <p id="semantic-setup-description" className="semantic-setup-description">
            Find documents by meaning, not just keywords. Search across all your
            markdown files using AI-powered understanding.
          </p>
        </div>

        {/* Features */}
        <div className="semantic-setup-features">
          <div className="semantic-setup-feature">
            <CheckIcon />
            <span>Search by concepts and ideas</span>
          </div>
          <div className="semantic-setup-feature">
            <CheckIcon />
            <span>Find related documents automatically</span>
          </div>
          <div className="semantic-setup-feature">
            <CheckIcon />
            <span>Works completely offline</span>
          </div>
        </div>

        {/* Folder Selection */}
        <div className="semantic-setup-section">
          <h3 className="semantic-setup-section-title">Select folders to index</h3>
          <p className="semantic-setup-section-hint">
            Choose which folders contain your markdown files.
          </p>

          {/* Folder List */}
          <div className="semantic-setup-folders">
            {folders.length === 0 ? (
              <div className="semantic-setup-folders-empty">
                <FolderIcon />
                <span>No folders selected</span>
              </div>
            ) : (
              folders.map((folder) => (
                <div key={folder.path} className="semantic-setup-folder">
                  <FolderIcon />
                  <div className="semantic-setup-folder-info">
                    <span className="semantic-setup-folder-name">{folder.name}</span>
                    <span className="semantic-setup-folder-path">{folder.path}</span>
                  </div>
                  <button
                    className="semantic-setup-folder-remove"
                    onClick={() => handleRemoveFolder(folder.path)}
                    title="Remove folder"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Folder Buttons */}
          <div className="semantic-setup-folder-actions">
            <button
              className="semantic-setup-btn-secondary"
              onClick={handleAddDocuments}
            >
              <FolderIcon />
              Add Documents
            </button>
            <button
              className="semantic-setup-btn-secondary"
              onClick={handleAddFolder}
              disabled={isSelecting}
            >
              <PlusIcon />
              Add Folder...
            </button>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="semantic-setup-privacy">
          <ShieldIcon />
          <span>
            All processing happens on your device. Your files never leave your computer.
          </span>
        </div>

        {/* Actions */}
        <div className="semantic-setup-actions">
          <button className="semantic-setup-btn-ghost" onClick={handleSkip}>
            Maybe Later
          </button>
          <button
            className="semantic-setup-btn-primary"
            onClick={handleEnable}
            disabled={folders.length === 0}
          >
            Enable Semantic Search
          </button>
        </div>
      </div>
    </div>
  );
}

// Icons

function BrainIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

function CheckIcon() {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FolderIcon() {
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
    </svg>
  );
}

function CloseIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PlusIcon() {
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
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ShieldIcon() {
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
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default SemanticSetupDialog;
