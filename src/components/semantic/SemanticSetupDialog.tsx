/**
 * SemanticSetupDialog Component
 *
 * First-time setup dialog for semantic search.
 * Allows users to enable semantic search and select folders to index.
 */

import { useState, useCallback } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { Brain, Check, Folder, X, Plus, Shield } from "lucide-react";

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
            <Brain className="h-8 w-8" />
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
            <Check className="h-4 w-4" />
            <span>Search by concepts and ideas</span>
          </div>
          <div className="semantic-setup-feature">
            <Check className="h-4 w-4" />
            <span>Find related documents automatically</span>
          </div>
          <div className="semantic-setup-feature">
            <Check className="h-4 w-4" />
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
                <Folder className="h-4 w-4" />
                <span>No folders selected</span>
              </div>
            ) : (
              folders.map((folder) => (
                <div key={folder.path} className="semantic-setup-folder">
                  <Folder className="h-4 w-4" />
                  <div className="semantic-setup-folder-info">
                    <span className="semantic-setup-folder-name">{folder.name}</span>
                    <span className="semantic-setup-folder-path">{folder.path}</span>
                  </div>
                  <button
                    className="semantic-setup-folder-remove"
                    onClick={() => handleRemoveFolder(folder.path)}
                    title="Remove folder"
                  >
                    <X className="h-3.5 w-3.5" />
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
              <Folder className="h-4 w-4" />
              Add Documents
            </button>
            <button
              className="semantic-setup-btn-secondary"
              onClick={handleAddFolder}
              disabled={isSelecting}
            >
              <Plus className="h-4 w-4" />
              Add Folder...
            </button>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="semantic-setup-privacy">
          <Shield className="h-3.5 w-3.5" />
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

export default SemanticSetupDialog;
