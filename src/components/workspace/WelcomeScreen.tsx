import { useMemo } from "react";
import { Folder, FolderOpen, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="flex items-center justify-center h-[calc(100vh-3rem)] p-8 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
      <div className="max-w-[480px] w-full">
        {/* Header */}
        <header className="text-center mb-10">
          <h1 className="font-serif text-[3.5rem] font-light text-[var(--color-ink)] m-0 tracking-[-0.03em]">Jot</h1>
          <p className="font-serif text-lg italic text-[var(--color-ink-muted)] mt-2">A place to think</p>
        </header>

        {/* Actions */}
        <section className="text-center mb-8">
          <button
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-accent)] text-white font-sans text-sm font-medium rounded-lg cursor-pointer transition-all hover:opacity-90 hover:-translate-y-0.5"
            onClick={onOpenFolder}
          >
            <Folder className="h-4 w-4" />
            <span>Open Folder</span>
          </button>
          <p className="font-sans text-xs text-[var(--color-ink-muted)] mt-3">
            <kbd className="px-1.5 py-0.5 bg-[var(--color-border)] rounded text-[0.6875rem]">⌘</kbd>
            {" + "}
            <kbd className="px-1.5 py-0.5 bg-[var(--color-border)] rounded text-[0.6875rem]">O</kbd>
          </p>
        </section>

        {/* Recent Workspaces */}
        {hasRecent && (
          <section className="mt-8">
            <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-muted)] mb-3 px-1">Recent</h2>
            <ul className="list-none p-0 m-0 space-y-1">
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
          <section className="text-center mt-8">
            <p className="font-sans text-sm text-[var(--color-ink-muted)]">
              Open a folder to start organizing your markdown notes.
            </p>
          </section>
        )}
      </div>
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
    <li className="flex items-center rounded-lg hover:bg-[var(--color-paper-warm)] transition-colors group">
      <button
        className="flex items-center flex-1 gap-3 px-3 py-2.5 border-none bg-transparent cursor-pointer text-left"
        onClick={onOpen}
        title={workspace.path}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded bg-[var(--color-border)] text-[var(--color-ink-muted)]">
          <FolderOpen className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="font-sans text-sm font-medium text-[var(--color-ink)] flex items-center gap-1.5">
            {workspace.name}
            {isDefault && (
              <span className="text-[var(--color-accent)]" title="Default workspace">
                ✦
              </span>
            )}
          </span>
          <span className="font-mono text-xs text-[var(--color-ink-muted)] block mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">{truncatedPath}</span>
        </div>
        <span className="font-sans text-xs text-[var(--color-ink-muted)] shrink-0">{formattedDate}</span>
      </button>
      <div className="flex items-center gap-1 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className={cn(
            "flex items-center justify-center w-7 h-7 border-none bg-transparent rounded cursor-pointer transition-colors",
            "text-[var(--color-ink-muted)] hover:bg-[var(--color-border)] hover:text-[var(--color-accent)]",
            isDefault && "text-[var(--color-accent)]"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSetDefault();
          }}
          title={isDefault ? "Remove as default" : "Set as default workspace"}
        >
          {isDefault ? <Star className="h-4 w-4 fill-current" /> : <Star className="h-4 w-4" />}
        </button>
        <button
          className="flex items-center justify-center w-7 h-7 border-none bg-transparent rounded cursor-pointer text-[var(--color-ink-muted)] transition-colors hover:bg-[rgba(196,93,62,0.1)] hover:text-[#c45d3e]"
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
