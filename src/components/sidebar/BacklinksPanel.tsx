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
      className="backlink-item"
      onClick={handleClick}
      data-testid={`backlink-item-${backlink.sourceName}`}
    >
      {/* Source file icon */}
      <span className="backlink-icon">
        <File className="h-4 w-4" />
      </span>

      <div className="backlink-content">
        {/* Source file name */}
        <span className="backlink-source">{backlink.sourceName}</span>

        {/* Link text used */}
        <span className="backlink-link-text">
          <Link className="h-3 w-3" />
          {backlink.linkText}
        </span>

        {/* Context snippet */}
        {backlink.context && (
          <span className="backlink-context">{backlink.context}</span>
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
      <div className="backlinks-empty-state">
        <div className="backlinks-empty-icon">
          <Link2 className="h-8 w-8" />
        </div>
        <p className="backlinks-empty-title">No backlinks</p>
        <p className="backlinks-empty-hint">
          Other documents that link to this file will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="backlinks-panel" data-testid="backlinks-panel">
      {/* Backlinks list */}
      <div className="backlinks-list">
        {backlinks.map((backlink, index) => (
          <BacklinkItem
            key={`${backlink.sourcePath}-${index}`}
            backlink={backlink}
            onClick={onBacklinkClick}
          />
        ))}
      </div>

      {/* Stats footer */}
      <div className="backlinks-footer">
        <span className="backlinks-stats">
          {backlinks.length} backlink{backlinks.length === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

export default BacklinksPanel;
