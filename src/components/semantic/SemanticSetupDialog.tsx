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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

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

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="max-w-md"
        showCloseButton={false}
      >
        {/* Header with icon */}
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Brain className="size-8" />
          </div>
          <DialogTitle className="text-lg">Semantic Search</DialogTitle>
          <DialogDescription>
            Find documents by meaning, not just keywords. Search across all your
            markdown files using AI-powered understanding.
          </DialogDescription>
        </DialogHeader>

        {/* Features */}
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Check className="size-4 text-primary" />
            <span>Search by concepts and ideas</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Check className="size-4 text-primary" />
            <span>Find related documents automatically</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Check className="size-4 text-primary" />
            <span>Works completely offline</span>
          </div>
        </div>

        {/* Folder Selection */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium">Select folders to index</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose which folders contain your markdown files.
            </p>
          </div>

          {/* Folder List */}
          <div className="min-h-[100px] max-h-[200px] overflow-y-auto rounded-lg border bg-background">
            {folders.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 py-8 text-muted-foreground">
                <Folder className="size-5" />
                <span className="text-sm">No folders selected</span>
              </div>
            ) : (
              <div className="divide-y">
                {folders.map((folder) => (
                  <div
                    key={folder.path}
                    className="flex items-center gap-3 px-3 py-2 group"
                  >
                    <Folder className="size-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {folder.name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {folder.path}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemoveFolder(folder.path)}
                      title="Remove folder"
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Folder Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddDocuments}
              className="flex-1"
            >
              <Folder className="size-4" />
              Add Documents
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddFolder}
              disabled={isSelecting}
              className="flex-1"
            >
              <Plus className="size-4" />
              Add Folder...
            </Button>
          </div>
        </div>

        {/* Privacy Notice */}
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <Shield className="size-3.5 shrink-0" />
          <span>
            All processing happens on your device. Your files never leave your computer.
          </span>
        </div>

        {/* Actions */}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Maybe Later
          </Button>
          <Button onClick={handleEnable} disabled={folders.length === 0}>
            Enable Semantic Search
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SemanticSetupDialog;
