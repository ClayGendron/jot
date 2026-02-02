/**
 * DiffViewer Component
 *
 * Side-by-side comparison of two document versions.
 * Aesthetic: Technical precision - clean monospace typography
 * with color-coded additions and deletions.
 */

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
      <div className="fixed inset-0 z-[1000] flex flex-col bg-[var(--color-paper)]">
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-[var(--color-ink-muted)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--color-accent)]" />
          <span className="font-sans text-sm">Computing differences...</span>
        </div>
      </div>
    );
  }

  if (error || !diff || !oldVersion || !newVersion) {
    return (
      <div className="fixed inset-0 z-[1000] flex flex-col bg-[var(--color-paper)]">
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-[var(--color-error)]">
          <span className="font-sans text-sm">{error || "Failed to load diff"}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 font-sans text-sm bg-[var(--color-border)] rounded cursor-pointer hover:bg-[var(--color-border-strong)]"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col bg-[var(--color-paper)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-paper-warm)] border-b border-[var(--color-border)]">
        <div className="flex items-center gap-4">
          <h3 className="font-sans text-sm font-semibold text-[var(--color-ink)] m-0">Compare Versions</h3>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[#22863a]">+{diff.additions}</span>
            <span className="text-[#cb2431]">-{diff.deletions}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex border border-[var(--color-border)] rounded overflow-hidden">
            <button
              className={cn(
                "px-3 py-1.5 font-sans text-xs border-none cursor-pointer transition-colors",
                viewMode === "split" ? "bg-[var(--color-accent)] text-white" : "bg-transparent text-[var(--color-ink-muted)] hover:bg-[var(--color-paper-warm)]"
              )}
              onClick={() => setViewMode("split")}
            >
              Split
            </button>
            <button
              className={cn(
                "px-3 py-1.5 font-sans text-xs border-none cursor-pointer transition-colors",
                viewMode === "unified" ? "bg-[var(--color-accent)] text-white" : "bg-transparent text-[var(--color-ink-muted)] hover:bg-[var(--color-paper-warm)]"
              )}
              onClick={() => setViewMode("unified")}
            >
              Unified
            </button>
          </div>
          <button
            className="flex items-center justify-center w-8 h-8 border-none bg-transparent rounded text-[var(--color-ink-muted)] cursor-pointer hover:bg-[var(--color-border)] hover:text-[var(--color-ink)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Version headers */}
      <div className="flex border-b border-[var(--color-border)]">
        <div className="flex-1 flex items-center justify-between px-4 py-2 bg-[rgba(203,36,49,0.05)] border-r border-[var(--color-border)]">
          <span className="font-sans text-xs font-semibold text-[#cb2431] uppercase">Older</span>
          <span className="font-sans text-xs text-[var(--color-ink-muted)]">
            {formatVersionDate(oldVersion.created_at)}
          </span>
          <button
            className="px-2 py-1 font-sans text-xs bg-transparent border border-[var(--color-border)] rounded cursor-pointer hover:bg-[var(--color-paper-warm)]"
            onClick={() => onRestoreOld(oldVersion.content)}
          >
            Restore
          </button>
        </div>
        <div className="flex-1 flex items-center justify-between px-4 py-2 bg-[rgba(34,134,58,0.05)]">
          <span className="font-sans text-xs font-semibold text-[#22863a] uppercase">Newer</span>
          <span className="font-sans text-xs text-[var(--color-ink-muted)]">
            {formatVersionDate(newVersion.created_at)}
          </span>
          <button
            className="px-2 py-1 font-sans text-xs bg-transparent border border-[var(--color-border)] rounded cursor-pointer hover:bg-[var(--color-paper-warm)]"
            onClick={() => onRestoreNew(newVersion.content)}
          >
            Restore
          </button>
        </div>
      </div>

      {/* Diff content */}
      <div className={cn("flex-1 overflow-y-auto", viewMode === "split" && "flex")}>
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
    <>
      <div className="flex-1 overflow-y-auto border-r border-[var(--color-border)]">
        {pairs.map((pair, idx) => (
          <DiffLineRow
            key={`old-${idx}`}
            line={pair.old}
            side="old"
          />
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {pairs.map((pair, idx) => (
          <DiffLineRow
            key={`new-${idx}`}
            line={pair.new}
            side="new"
          />
        ))}
      </div>
    </>
  );
}

/** Unified view - interleaved */
function UnifiedView({ lines }: { lines: DiffLine[] }) {
  return (
    <div>
      {lines.map((line, idx) => (
        <div
          key={idx}
          className={cn(
            "flex font-mono text-[0.8125rem]",
            line.change_type === "insert" && "bg-[rgba(34,134,58,0.1)]",
            line.change_type === "delete" && "bg-[rgba(203,36,49,0.1)]"
          )}
        >
          <span className="w-10 px-2 py-0.5 text-right text-[var(--color-ink-muted)] select-none shrink-0 border-r border-[var(--color-border)]">
            {line.line_num_old ?? ""}
          </span>
          <span className="w-10 px-2 py-0.5 text-right text-[var(--color-ink-muted)] select-none shrink-0 border-r border-[var(--color-border)]">
            {line.line_num_new ?? ""}
          </span>
          <span className={cn(
            "w-6 text-center py-0.5 select-none shrink-0",
            line.change_type === "insert" && "text-[#22863a]",
            line.change_type === "delete" && "text-[#cb2431]"
          )}>
            {line.change_type === "insert" ? "+" : line.change_type === "delete" ? "-" : " "}
          </span>
          <span className="flex-1 px-2 py-0.5 whitespace-pre">{line.content}</span>
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
    return <div className="h-6 bg-[var(--color-paper-warm)]" />;
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
    <div className={cn(
      "flex font-mono text-[0.8125rem]",
      changeType === "insert" && "bg-[rgba(34,134,58,0.1)]",
      changeType === "delete" && "bg-[rgba(203,36,49,0.1)]"
    )}>
      <span className="w-12 px-2 py-0.5 text-right text-[var(--color-ink-muted)] select-none shrink-0 border-r border-[var(--color-border)]">
        {side === "old" ? line.line_num_old : line.line_num_new}
      </span>
      <span className="flex-1 px-2 py-0.5 whitespace-pre">{line.content}</span>
    </div>
  );
}

export default DiffViewer;
