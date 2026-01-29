/**
 * DiffViewer Component
 *
 * Side-by-side comparison of two document versions.
 * Aesthetic: Technical precision - clean monospace typography
 * with color-coded additions and deletions.
 */

import { useState, useEffect } from "react";
import {
  diffVersions,
  getVersion,
  formatVersionDate,
  type VersionDiff,
  type DiffLine,
  type Version,
} from "@/lib/tauri/versionHistory";

interface DiffViewerProps {
  workspacePath: string;
  oldVersionId: number;
  newVersionId: number;
  onClose: () => void;
  onRestoreOld: (content: string) => void;
  onRestoreNew: (content: string) => void;
}

export function DiffViewer({
  workspacePath,
  oldVersionId,
  newVersionId,
  onClose,
  onRestoreOld,
  onRestoreNew,
}: DiffViewerProps) {
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [oldVersion, setOldVersion] = useState<Version | null>(null);
  const [newVersion, setNewVersion] = useState<Version | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");

  // Load diff and version metadata
  useEffect(() => {
    const loadDiff = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [diffResult, oldVer, newVer] = await Promise.all([
          diffVersions(workspacePath, oldVersionId, newVersionId),
          getVersion(workspacePath, oldVersionId),
          getVersion(workspacePath, newVersionId),
        ]);
        setDiff(diffResult);
        setOldVersion(oldVer);
        setNewVersion(newVer);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load diff");
      } finally {
        setIsLoading(false);
      }
    };
    loadDiff();
  }, [workspacePath, oldVersionId, newVersionId]);

  if (isLoading) {
    return (
      <div className="diff-viewer">
        <div className="diff-viewer-loading">
          <div className="diff-viewer-spinner" />
          <span>Computing differences...</span>
        </div>
      </div>
    );
  }

  if (error || !diff || !oldVersion || !newVersion) {
    return (
      <div className="diff-viewer">
        <div className="diff-viewer-error">
          <span>{error || "Failed to load diff"}</span>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="diff-viewer">
      {/* Header */}
      <div className="diff-viewer-header">
        <div className="diff-viewer-title">
          <h3>Compare Versions</h3>
          <div className="diff-viewer-stats">
            <span className="diff-stat-add">+{diff.additions}</span>
            <span className="diff-stat-del">-{diff.deletions}</span>
          </div>
        </div>
        <div className="diff-viewer-actions">
          <div className="diff-view-toggle">
            <button
              className={viewMode === "split" ? "active" : ""}
              onClick={() => setViewMode("split")}
            >
              Split
            </button>
            <button
              className={viewMode === "unified" ? "active" : ""}
              onClick={() => setViewMode("unified")}
            >
              Unified
            </button>
          </div>
          <button className="diff-viewer-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Version headers */}
      <div className="diff-version-headers">
        <div className="diff-version-header diff-version-old">
          <span className="diff-version-label">Older</span>
          <span className="diff-version-date">
            {formatVersionDate(oldVersion.created_at)}
          </span>
          <button
            className="diff-version-restore"
            onClick={() => onRestoreOld(oldVersion.content)}
          >
            Restore
          </button>
        </div>
        <div className="diff-version-header diff-version-new">
          <span className="diff-version-label">Newer</span>
          <span className="diff-version-date">
            {formatVersionDate(newVersion.created_at)}
          </span>
          <button
            className="diff-version-restore"
            onClick={() => onRestoreNew(newVersion.content)}
          >
            Restore
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className={`diff-content ${viewMode}`}>
        {viewMode === "split" ? (
          <SplitView lines={diff.lines} />
        ) : (
          <UnifiedView lines={diff.lines} />
        )}
      </div>
    </div>
  );
}

/** Split view - side by side */
function SplitView({ lines }: { lines: DiffLine[] }) {
  // Build paired lines for split view
  const pairs: Array<{ old: DiffLine | null; new: DiffLine | null }> = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.change_type === "equal") {
      pairs.push({ old: line, new: line });
      i++;
    } else if (line.change_type === "delete") {
      // Look ahead for corresponding insert
      const nextInsert = lines[i + 1]?.change_type === "insert" ? lines[i + 1] : null;
      pairs.push({ old: line, new: nextInsert });
      i += nextInsert ? 2 : 1;
    } else if (line.change_type === "insert") {
      pairs.push({ old: null, new: line });
      i++;
    }
  }

  return (
    <div className="diff-split">
      <div className="diff-pane diff-pane-old">
        {pairs.map((pair, idx) => (
          <DiffLineRow
            key={`old-${idx}`}
            line={pair.old}
            side="old"
          />
        ))}
      </div>
      <div className="diff-pane diff-pane-new">
        {pairs.map((pair, idx) => (
          <DiffLineRow
            key={`new-${idx}`}
            line={pair.new}
            side="new"
          />
        ))}
      </div>
    </div>
  );
}

/** Unified view - interleaved */
function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="diff-unified">
      {lines.map((line, idx) => (
        <div
          key={idx}
          className={`diff-line diff-line-${line.change_type}`}
        >
          <span className="diff-line-num diff-line-num-old">
            {line.line_num_old ?? ""}
          </span>
          <span className="diff-line-num diff-line-num-new">
            {line.line_num_new ?? ""}
          </span>
          <span className="diff-line-marker">
            {line.change_type === "insert" ? "+" : line.change_type === "delete" ? "-" : " "}
          </span>
          <span className="diff-line-content">{line.content}</span>
        </div>
      ))}
    </div>
  );
}

/** Individual diff line row */
function DiffLineRow({
  line,
  side,
}: {
  line: DiffLine | null;
  side: "old" | "new";
}) {
  if (!line) {
    return <div className="diff-line diff-line-empty" />;
  }

  const changeType =
    line.change_type === "equal"
      ? "equal"
      : side === "old" && line.change_type === "delete"
        ? "delete"
        : side === "new" && line.change_type === "insert"
          ? "insert"
          : "equal";

  return (
    <div className={`diff-line diff-line-${changeType}`}>
      <span className="diff-line-num">
        {side === "old" ? line.line_num_old : line.line_num_new}
      </span>
      <span className="diff-line-content">{line.content}</span>
    </div>
  );
}

function CloseIcon() {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export default DiffViewer;
