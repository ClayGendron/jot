/**
 * VersionHistoryPanel Component
 *
 * Displays document version history in a timeline format.
 * Aesthetic: Archival/museum catalog - understated elegance with
 * subtle textures and careful typography.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  History,
  AlertCircle,
  GitCompare,
  Check,
  Trash2,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getVersions,
  getVersion,
  deleteVersion,
  formatVersionDate,
  formatByteSize,
  formatWordCount,
  type VersionMeta,
  type Version,
} from "@/lib/tauri/versionHistory";

interface VersionHistoryPanelProps {
  filePath: string;
  workspacePath: string;
  onRestore: (content: string) => void;
  onClose: () => void;
  onCompare: (oldVersionId: number, newVersionId: number) => void;
}

export function VersionHistoryPanel({
  filePath,
  workspacePath,
  onRestore,
  onClose,
  onCompare,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelection, setCompareSelection] = useState<number[]>([]);

  // Load versions on mount
  useEffect(() => {
    const loadVersions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getVersions(workspacePath, filePath, 100);
        setVersions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load versions");
      } finally {
        setIsLoading(false);
      }
    };
    loadVersions();
  }, [workspacePath, filePath]);

  // Select a version to preview
  const handleSelectVersion = useCallback(
    async (versionId: number) => {
      if (compareMode) {
        // In compare mode, toggle selection
        setCompareSelection((prev) => {
          if (prev.includes(versionId)) {
            return prev.filter((id) => id !== versionId);
          }
          if (prev.length < 2) {
            return [...prev, versionId];
          }
          // Replace the oldest selection
          return [prev[1], versionId];
        });
        return;
      }

      try {
        const version = await getVersion(workspacePath, versionId);
        setSelectedVersion(version);
      } catch (err) {
        console.error("Failed to load version:", err);
      }
    },
    [workspacePath, compareMode]
  );

  // Restore a version
  const handleRestore = useCallback(async () => {
    if (!selectedVersion) return;

    const confirmed = window.confirm(
      `Restore this version from ${formatVersionDate(selectedVersion.created_at)}?\n\nYour current changes will be replaced.`
    );
    if (confirmed) {
      onRestore(selectedVersion.content);
    }
  }, [selectedVersion, onRestore]);

  // Delete a version
  const handleDelete = useCallback(
    async (versionId: number, event: React.MouseEvent) => {
      event.stopPropagation();
      const confirmed = window.confirm("Delete this version? This cannot be undone.");
      if (!confirmed) return;

      try {
        await deleteVersion(workspacePath, versionId);
        setVersions((prev) => prev.filter((v) => v.id !== versionId));
        if (selectedVersion?.id === versionId) {
          setSelectedVersion(null);
        }
      } catch (err) {
        console.error("Failed to delete version:", err);
      }
    },
    [workspacePath, selectedVersion]
  );

  // Start comparison
  const handleStartCompare = useCallback(() => {
    if (compareSelection.length === 2) {
      const [older, newer] = compareSelection.sort((a, b) => a - b);
      onCompare(older, newer);
    }
  }, [compareSelection, onCompare]);

  // Group versions by date
  const groupedVersions = useMemo(() => {
    const groups: { [key: string]: VersionMeta[] } = {};
    for (const version of versions) {
      const date = new Date(version.created_at);
      const key = date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      if (!groups[key]) groups[key] = [];
      groups[key].push(version);
    }
    return groups;
  }, [versions]);

  if (isLoading) {
    return (
      <div className="w-[340px] flex flex-col bg-[var(--color-paper)] border-l border-[var(--color-border)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-gradient-to-b from-[var(--color-paper-warm)] to-[var(--color-paper)]">
          <h3 className="font-serif text-base font-semibold text-[var(--color-ink)] m-0">Version History</h3>
          <button
            className="flex items-center justify-center w-7 h-7 border-none bg-transparent rounded text-[var(--color-ink-muted)] cursor-pointer transition-colors hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-[var(--color-ink-muted)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
          <span className="font-sans text-sm">Loading history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-[340px] flex flex-col bg-[var(--color-paper)] border-l border-[var(--color-border)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-gradient-to-b from-[var(--color-paper-warm)] to-[var(--color-paper)]">
          <h3 className="font-serif text-base font-semibold text-[var(--color-ink)] m-0">Version History</h3>
          <button
            className="flex items-center justify-center w-7 h-7 border-none bg-transparent rounded text-[var(--color-ink-muted)] cursor-pointer transition-colors hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 gap-2 px-4 text-center text-[var(--color-error)]">
          <AlertCircle className="h-5 w-5" />
          <span className="font-sans text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[340px] flex flex-col bg-[var(--color-paper)] border-l border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-gradient-to-b from-[var(--color-paper-warm)] to-[var(--color-paper)]">
        <div className="flex items-center gap-2">
          <h3 className="font-serif text-base font-semibold text-[var(--color-ink)] m-0">Version History</h3>
          <span className="font-mono text-[0.625rem] text-[var(--color-ink-muted)] px-1.5 py-0.5 bg-[var(--color-border)] rounded">
            {versions.length} version{versions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 border border-transparent bg-transparent rounded font-sans text-xs cursor-pointer transition-colors",
              "hover:bg-[var(--color-paper-warm)] text-[var(--color-ink-muted)]",
              compareMode && "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
            )}
            onClick={() => {
              setCompareMode(!compareMode);
              setCompareSelection([]);
            }}
            title="Compare versions"
          >
            <GitCompare className="h-3.5 w-3.5" />
            <span>Compare</span>
          </button>
          <button
            className="flex items-center justify-center w-7 h-7 border-none bg-transparent rounded text-[var(--color-ink-muted)] cursor-pointer transition-colors hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Compare mode instructions */}
      {compareMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-accent-soft)] border-b border-[var(--color-border)]">
          <span className="font-sans text-xs text-[var(--color-accent)]">
            Select two versions to compare
          </span>
          {compareSelection.length === 2 && (
            <button
              className="px-2.5 py-1 bg-[var(--color-accent)] text-white font-sans text-xs font-medium rounded cursor-pointer transition-colors hover:opacity-90"
              onClick={handleStartCompare}
            >
              View Diff
            </button>
          )}
        </div>
      )}

      {/* Versions list */}
      <div className="flex-1 overflow-y-auto">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-[var(--color-ink-muted)]">
            <History className="h-8 w-8 mb-4 opacity-50" />
            <p className="font-sans text-sm font-medium text-[var(--color-ink-light)] m-0 mb-1">No versions yet</p>
            <p className="font-sans text-[0.8125rem] text-[var(--color-ink-muted)] m-0">
              Versions are created automatically when you save
            </p>
          </div>
        ) : (
          <div className="py-2">
            {Object.entries(groupedVersions).map(([date, dayVersions]) => (
              <div key={date} className="mb-2">
                <div className="sticky top-0 z-10 px-4 py-1.5 bg-[var(--color-paper-warm)] border-b border-[var(--color-border)]">
                  <span className="font-sans text-[0.6875rem] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wide">{date}</span>
                </div>
                {dayVersions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    className={cn(
                      "relative flex items-start w-full px-4 py-2.5 border-none bg-transparent text-left cursor-pointer transition-colors",
                      "hover:bg-[var(--color-paper-warm)]",
                      selectedVersion?.id === version.id && "bg-[var(--color-accent-soft)]",
                      compareSelection.includes(version.id) && "bg-[var(--color-accent-soft)]"
                    )}
                    onClick={() => handleSelectVersion(version.id)}
                  >
                    <div className="flex items-center justify-center w-5 mr-3 pt-1">
                      {compareMode ? (
                        <div
                          className={cn(
                            "w-4 h-4 rounded border-2 border-[var(--color-border)] flex items-center justify-center transition-colors",
                            compareSelection.includes(version.id) && "bg-[var(--color-accent)] border-[var(--color-accent)]"
                          )}
                        >
                          {compareSelection.includes(version.id) && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                        </div>
                      ) : (
                        <div className={cn(
                          "w-2 h-2 rounded-full bg-[var(--color-border)]",
                          (selectedVersion?.id === version.id) && "bg-[var(--color-accent)]"
                        )} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-[var(--color-ink-light)]">
                        {new Date(version.created_at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="font-sans text-sm text-[var(--color-ink)] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">{version.preview}</div>
                      <div className="font-mono text-[0.6875rem] text-[var(--color-ink-muted)] mt-1 flex items-center gap-1">
                        <span>{formatWordCount(version.word_count)}</span>
                        <span>·</span>
                        <span>{formatByteSize(version.byte_size)}</span>
                      </div>
                    </div>
                    {!compareMode && (
                      <button
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 border-none bg-transparent rounded text-[var(--color-ink-muted)] cursor-pointer opacity-0 transition-opacity hover:bg-[var(--color-border)] hover:text-[var(--color-error)] group-hover:opacity-100 [.version-item:hover_&]:opacity-100"
                        onClick={(e) => handleDelete(version.id, e)}
                        title="Delete version"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview panel */}
      {selectedVersion && !compareMode && (
        <div className="border-t border-[var(--color-border)] max-h-[40%] flex flex-col bg-[var(--color-paper-warm)]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border)]">
            <span className="font-sans text-xs text-[var(--color-ink-muted)]">
              {formatVersionDate(selectedVersion.created_at)}
            </span>
            <div>
              <button
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-accent)] text-white font-sans text-xs font-medium rounded cursor-pointer transition-colors hover:opacity-90"
                onClick={handleRestore}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <pre className="font-mono text-xs text-[var(--color-ink-light)] leading-relaxed whitespace-pre-wrap m-0">{selectedVersion.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default VersionHistoryPanel;
