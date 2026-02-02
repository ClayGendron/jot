/**
 * IndexingProgress Component
 *
 * Displays progress indicator during semantic search indexing.
 */

import type { IndexingProgress as IndexingProgressData } from "@/lib/semantic/types";
import { Brain } from "lucide-react";

interface IndexingProgressProps {
  progress: IndexingProgressData;
  onCancel?: () => void;
}

export function IndexingProgress({ progress, onCancel }: IndexingProgressProps) {
  const percentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="indexing-progress">
      <div className="indexing-progress-header">
        <Brain className="h-3.5 w-3.5" />
        <span className="indexing-progress-title">Indexing documents</span>
      </div>

      <div className="indexing-progress-bar-container">
        <div
          className="indexing-progress-bar"
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="indexing-progress-info">
        <span className="indexing-progress-count">
          {progress.current} of {progress.total} files
        </span>
        {progress.currentFile && (
          <span className="indexing-progress-file" title={progress.currentFile}>
            {truncateFileName(progress.currentFile)}
          </span>
        )}
      </div>

      {onCancel && (
        <button className="indexing-progress-cancel" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

/**
 * Compact indexing indicator for status bar
 */
export function IndexingIndicator({ progress }: { progress: IndexingProgressData }) {
  const percentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="indexing-indicator" title={`Indexing: ${progress.current}/${progress.total}`}>
      <Brain className="h-3.5 w-3.5" />
      <div className="indexing-indicator-bar">
        <div
          className="indexing-indicator-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="indexing-indicator-text">{percentage}%</span>
    </div>
  );
}

function truncateFileName(path: string, maxLength: number = 30): string {
  const name = path.split(/[/\\]/).pop() || path;
  if (name.length <= maxLength) return name;
  return `...${name.slice(-maxLength + 3)}`;
}

export default IndexingProgress;
