/**
 * BacklinksPanel Component
 *
 * Displays documents that link to the currently open file.
 * Shows source file name, link text, and context around the link.
 */

import { useCallback } from "react";
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
        <FileIcon />
      </span>

      <div className="backlink-content">
        {/* Source file name */}
        <span className="backlink-source">{backlink.sourceName}</span>

        {/* Link text used */}
        <span className="backlink-link-text">
          <LinkIcon />
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
          <BacklinksIcon />
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

// Icons

function BacklinksIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Incoming arrows pointing to center document */}
      <rect x="11" y="10" width="10" height="12" rx="2" />
      <path d="M5 16h6" />
      <path d="M8 13l-3 3 3 3" />
      <path d="M21 8l5-4" />
      <path d="M23 4h3v3" />
      <path d="M21 24l5 4" />
      <path d="M23 28h3v-3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export default BacklinksPanel;
