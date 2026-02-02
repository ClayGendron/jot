import { useMemo } from "react";
import { Folder, FolderOpen, Star, X } from "lucide-react";
import type { RecentWorkspace } from "@/lib/settings/types";

/**
 * WelcomeScreen - Shown when no workspace is open
 *
 * Displays recent workspaces and options to open or create workspaces.
 * Aesthetic: Editorial warmth with refined typography
 */

interface WelcomeScreenProps {
  recentWorkspaces: RecentWorkspace[];
  defaultWorkspacePath: string | null;
  onOpenFolder: () => void;
  onOpenWorkspace: (path: string) => void;
  onSetDefault: (path: string | null) => void;
  onRemoveRecent: (path: string) => void;
}

export function WelcomeScreen({
  recentWorkspaces,
  defaultWorkspacePath,
  onOpenFolder,
  onOpenWorkspace,
  onSetDefault,
  onRemoveRecent,
}: WelcomeScreenProps) {
  const hasRecent = recentWorkspaces.length > 0;

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        {/* Header */}
        <header className="welcome-header">
          <h1 className="welcome-title">Jot</h1>
          <p className="welcome-tagline">A place to think</p>
        </header>

        {/* Actions */}
        <section className="welcome-actions">
          <button className="welcome-action-btn primary" onClick={onOpenFolder}>
            <Folder className="h-4 w-4" />
            <span>Open Folder</span>
          </button>
          <p className="welcome-shortcut">
            <kbd>⌘</kbd> + <kbd>O</kbd>
          </p>
        </section>

        {/* Recent Workspaces */}
        {hasRecent && (
          <section className="welcome-recent">
            <h2 className="welcome-section-title">Recent</h2>
            <ul className="welcome-recent-list">
              {recentWorkspaces.map((workspace) => (
                <RecentWorkspaceItem
                  key={workspace.path}
                  workspace={workspace}
                  isDefault={workspace.path === defaultWorkspacePath}
                  onOpen={() => onOpenWorkspace(workspace.path)}
                  onSetDefault={() =>
                    onSetDefault(
                      workspace.path === defaultWorkspacePath
                        ? null
                        : workspace.path
                    )
                  }
                  onRemove={() => onRemoveRecent(workspace.path)}
                />
              ))}
            </ul>
          </section>
        )}

        {/* Empty state for no recent */}
        {!hasRecent && (
          <section className="welcome-empty">
            <p className="welcome-empty-text">
              Open a folder to start organizing your markdown notes.
            </p>
          </section>
        )}
      </div>

      {/* Subtle decorative element */}
      <div className="welcome-decoration" aria-hidden="true" />
    </div>
  );
}

interface RecentWorkspaceItemProps {
  workspace: RecentWorkspace;
  isDefault: boolean;
  onOpen: () => void;
  onSetDefault: () => void;
  onRemove: () => void;
}

function RecentWorkspaceItem({
  workspace,
  isDefault,
  onOpen,
  onSetDefault,
  onRemove,
}: RecentWorkspaceItemProps) {
  const formattedDate = useMemo(() => {
    return formatRelativeDate(workspace.lastOpened);
  }, [workspace.lastOpened]);

  const truncatedPath = useMemo(() => {
    return truncatePath(workspace.path, 50);
  }, [workspace.path]);

  return (
    <li className="welcome-recent-item">
      <button
        className="welcome-recent-item-main"
        onClick={onOpen}
        title={workspace.path}
      >
        <div className="welcome-recent-item-icon">
          <FolderOpen className="h-4 w-4" />
        </div>
        <div className="welcome-recent-item-info">
          <span className="welcome-recent-item-name">
            {workspace.name}
            {isDefault && (
              <span className="welcome-recent-item-default" title="Default workspace">
                ✦
              </span>
            )}
          </span>
          <span className="welcome-recent-item-path">{truncatedPath}</span>
        </div>
        <span className="welcome-recent-item-date">{formattedDate}</span>
      </button>
      <div className="welcome-recent-item-actions">
        <button
          className="welcome-recent-action"
          onClick={(e) => {
            e.stopPropagation();
            onSetDefault();
          }}
          title={isDefault ? "Remove as default" : "Set as default workspace"}
        >
          {isDefault ? <Star className="h-4 w-4 fill-current" /> : <Star className="h-4 w-4" />}
        </button>
        <button
          className="welcome-recent-action danger"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove from recent"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

/**
 * Format a timestamp as relative date (e.g., "2 days ago", "Just now")
 */
function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  // Format as date for older items
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Truncate a path from the beginning, keeping the end visible
 */
function truncatePath(path: string, maxLength: number): string {
  if (path.length <= maxLength) return path;
  return "..." + path.slice(-(maxLength - 3));
}

export default WelcomeScreen;
