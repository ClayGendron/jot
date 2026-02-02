/**
 * BacklinksPanel Component
 *
 * Displays documents that link to the currently open file.
 * Shows source file name, link text, and context around the link.
 */

import { useCallback } from "react";
import { Link2, File, Link } from "lucide-react";
import type { BacklinkEntry } from "@/lib/links/backlinks";

interface BacklinkItemProps {
  backlink: BacklinkEntry;
  onClick: (path: string) => void;
}

function BacklinkItem({ backlink, onClick }: BacklinkItemProps) {
  const handleClick = useCallback(() => {
    onClick(backlink.sourcePath);
  }, [backlink.sourcePath, onClick]);

  return (
    <button
      type="button"
      className="flex items-start gap-2.5 w-full px-3 py-2.5 border-none bg-transparent text-left cursor-pointer transition-colors duration-150 hover:bg-[var(--color-hover)]"
      onClick={handleClick}
      data-testid={`backlink-item-${backlink.sourceName}`}
    >
      {/* Source file icon */}
      <span className="flex-shrink-0 text-[var(--color-accent)] opacity-70 mt-0.5">
        <File className="h-4 w-4" />
      </span>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        {/* Source file name */}
        <span className="font-sans text-[0.8125rem] font-medium text-[var(--color-ink)] overflow-hidden text-ellipsis whitespace-nowrap">
          {backlink.sourceName}
        </span>

        {/* Link text used */}
        <span className="flex items-center gap-1.5 font-sans text-xs text-[var(--color-accent)]">
          <Link className="h-3 w-3 flex-shrink-0 opacity-60" />
          {backlink.linkText}
        </span>

        {/* Context snippet */}
        {backlink.context && (
          <span className="font-sans text-[0.6875rem] text-[var(--color-ink-muted)] leading-tight line-clamp-2">
            {backlink.context}
          </span>
        )}
      </div>
    </button>
  );
}

interface BacklinksPanelProps {
  backlinks: BacklinkEntry[];
  onBacklinkClick: (path: string) => void;
}

export function BacklinksPanel({ backlinks, onBacklinkClick }: BacklinksPanelProps) {
  if (backlinks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="text-[var(--color-border-strong)] mb-4 opacity-60">
          <Link2 className="h-8 w-8" />
        </div>
        <p className="m-0 mb-1 font-sans text-sm font-medium text-[var(--color-ink-light)]">No backlinks</p>
        <p className="m-0 font-sans text-xs text-[var(--color-ink-muted)] italic">
          Other documents that link to this file will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="backlinks-panel">
      {/* Backlinks list */}
      <div className="flex-1 overflow-y-auto py-1">
        {backlinks.map((backlink, index) => (
          <BacklinkItem
            key={`${backlink.sourcePath}-${index}`}
            backlink={backlink}
            onClick={onBacklinkClick}
          />
        ))}
      </div>

      {/* Stats footer */}
      <div className="px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-paper-warm)]">
        <span className="font-sans text-[0.6875rem] text-[var(--color-ink-muted)] tracking-wide">
          {backlinks.length} backlink{backlinks.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

export default BacklinksPanel;
