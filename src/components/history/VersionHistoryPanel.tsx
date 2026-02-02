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
} from "lucide-react";
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
      <div className="version-history-panel">
        <div className="version-history-header">
          <h3 className="version-history-title">Version History</h3>
          <button className="version-history-close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="version-history-loading">
          <div className="version-history-spinner" />
          <span>Loading history...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="version-history-panel">
        <div className="version-history-header">
          <h3 className="version-history-title">Version History</h3>
          <button className="version-history-close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="version-history-error">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="version-history-panel">
      {/* Header */}
      <div className="version-history-header">
        <div className="version-history-header-left">
          <h3 className="version-history-title">Version History</h3>
          <span className="version-history-count">
            {versions.length} version{versions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="version-history-header-actions">
          <button
            className={`version-history-compare-toggle ${compareMode ? "active" : ""}`}
            onClick={() => {
              setCompareMode(!compareMode);
              setCompareSelection([]);
            }}
            title="Compare versions"
          >
            <GitCompare className="h-3.5 w-3.5" />
            <span>Compare</span>
          </button>
          <button className="version-history-close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Compare mode instructions */}
      {compareMode && (
        <div className="version-history-compare-bar">
          <span className="version-history-compare-hint">
            Select two versions to compare
          </span>
          {compareSelection.length === 2 && (
            <button
              className="version-history-compare-btn"
              onClick={handleStartCompare}
            >
              View Diff
            </button>
          )}
        </div>
      )}

      {/* Versions list */}
      <div className="version-history-content">
        {versions.length === 0 ? (
          <div className="version-history-empty">
            <History className="h-8 w-8" />
            <p className="version-history-empty-title">No versions yet</p>
            <p className="version-history-empty-hint">
              Versions are created automatically when you save
            </p>
          </div>
        ) : (
          <div className="version-timeline">
            {Object.entries(groupedVersions).map(([date, dayVersions]) => (
              <div key={date} className="version-date-group">
                <div className="version-date-header">
                  <span className="version-date-label">{date}</span>
                </div>
                {dayVersions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    className={`version-item ${
                      selectedVersion?.id === version.id ? "selected" : ""
                    } ${compareSelection.includes(version.id) ? "compare-selected" : ""}`}
                    onClick={() => handleSelectVersion(version.id)}
                  >
                    <div className="version-item-marker">
                      {compareMode ? (
                        <div
                          className={`version-checkbox ${
                            compareSelection.includes(version.id) ? "checked" : ""
                          }`}
                        >
                          {compareSelection.includes(version.id) && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                        </div>
                      ) : (
                        <div className="version-dot" />
                      )}
                    </div>
                    <div className="version-item-content">
                      <div className="version-item-time">
                        {new Date(version.created_at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="version-item-preview">{version.preview}</div>
                      <div className="version-item-meta">
                        <span>{formatWordCount(version.word_count)}</span>
                        <span className="version-meta-dot">·</span>
                        <span>{formatByteSize(version.byte_size)}</span>
                      </div>
                    </div>
                    {!compareMode && (
                      <button
                        className="version-item-delete"
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
        <div className="version-preview">
          <div className="version-preview-header">
            <span className="version-preview-time">
              {formatVersionDate(selectedVersion.created_at)}
            </span>
            <div className="version-preview-actions">
              <button
                className="version-preview-restore"
                onClick={handleRestore}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore
              </button>
            </div>
          </div>
          <div className="version-preview-content">
            <pre>{selectedVersion.content}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default VersionHistoryPanel;
