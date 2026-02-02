/**
 * IndexingProgress Component
 *
 * Displays progress indicator during semantic search indexing.
 * Uses shadcn Progress component with Base UI primitives.
 */

import type { IndexingProgress as IndexingProgressData } from "@/lib/semantic/types";
import { Brain, X } from "lucide-react";
import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface IndexingProgressProps {
  progress: IndexingProgressData;
  onCancel?: () => void;
}

export function IndexingProgress({ progress, onCancel }: IndexingProgressProps) {
  const percentage = progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-popover p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Brain className="h-3.5 w-3.5 text-primary" />
          <span>Indexing documents</span>
        </div>
        {onCancel && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onCancel}
            aria-label="Cancel indexing"
            className="h-5 w-5"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <Progress value={percentage}>
        <ProgressTrack className="h-1.5">
          <ProgressIndicator />
        </ProgressTrack>
      </Progress>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {progress.current} of {progress.total} files
        </span>
        {progress.currentFile && (
          <span className="max-w-40 truncate" title={progress.currentFile}>
            {truncateFileName(progress.currentFile)}
          </span>
        )}
      </div>
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
    <div
      className="flex items-center gap-1.5 text-xs text-muted-foreground"
      title={`Indexing: ${progress.current}/${progress.total}`}
    >
      <Brain className="h-3.5 w-3.5 animate-pulse text-primary" />
      <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="tabular-nums">{percentage}%</span>
    </div>
  );
}

function truncateFileName(path: string, maxLength: number = 30): string {
  const name = path.split(/[/\\]/).pop() || path;
  if (name.length <= maxLength) return name;
  return `...${name.slice(-maxLength + 3)}`;
}

export default IndexingProgress;
