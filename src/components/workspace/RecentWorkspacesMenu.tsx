import { useState, useRef, useEffect, useMemo } from "react";
import type { RecentWorkspace } from "@/lib/settings/types";

/**
 * RecentWorkspacesMenu - Dropdown menu for quick workspace switching
 *
 * Displayed in the sidebar header when a workspace is open.
 * Shows recent workspaces for quick navigation.
 */

interface RecentWorkspacesMenuProps {
  recentWorkspaces: RecentWorkspace[];
  currentWorkspacePath: string | null;
  defaultWorkspacePath: string | null;
  onOpenWorkspace: (path: string) => void;
  onOpenFolder: () => void;
  onSetDefault: (path: string | null) => void;
}

export function RecentWorkspacesMenu({
  recentWorkspaces,
  currentWorkspacePath,
  defaultWorkspacePath,
  onOpenWorkspace,
  onOpenFolder,
  onSetDefault,
}: RecentWorkspacesMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter out current workspace from the list
  const otherWorkspaces = useMemo(
    () => recentWorkspaces.filter((w) => w.path !== currentWorkspacePath),
    [recentWorkspaces, currentWorkspacePath]
  );

  const hasOtherWorkspaces = otherWorkspaces.length > 0;

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleWorkspaceClick = (path: string) => {
    onOpenWorkspace(path);
    setIsOpen(false);
  };

  const handleOpenFolderClick = () => {
    onOpenFolder();
    setIsOpen(false);
  };

  return (
    <div className="recent-workspaces-menu" ref={dropdownRef}>
      <button
        className="recent-workspaces-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Recent workspaces (⇧⌘O)"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <ChevronDownIcon isOpen={isOpen} />
      </button>

      {isOpen && (
        <div className="recent-workspaces-dropdown" role="listbox">
          {/* Section: Recent Workspaces */}
          {hasOtherWorkspaces && (
            <>
              <div className="recent-workspaces-section-title">Recent</div>
              {otherWorkspaces.map((workspace) => (
                <RecentWorkspaceOption
                  key={workspace.path}
                  workspace={workspace}
                  isDefault={workspace.path === defaultWorkspacePath}
                  onOpen={() => handleWorkspaceClick(workspace.path)}
                  onSetDefault={() =>
                    onSetDefault(
                      workspace.path === defaultWorkspacePath
                        ? null
                        : workspace.path
                    )
                  }
                />
              ))}
              <div className="recent-workspaces-divider" />
            </>
          )}

          {/* Open folder action */}
          <button
            className="recent-workspaces-action"
            onClick={handleOpenFolderClick}
          >
            <FolderPlusIcon />
            <span>Open Folder...</span>
            <span className="recent-workspaces-shortcut">⌘O</span>
          </button>
        </div>
      )}
    </div>
  );
}

interface RecentWorkspaceOptionProps {
  workspace: RecentWorkspace;
  isDefault: boolean;
  onOpen: () => void;
  onSetDefault: () => void;
}

function RecentWorkspaceOption({
  workspace,
  isDefault,
  onOpen,
  onSetDefault,
}: RecentWorkspaceOptionProps) {
  return (
    <div className="recent-workspace-option">
      <button
        className="recent-workspace-option-main"
        onClick={onOpen}
        title={workspace.path}
        role="option"
      >
        <FolderIcon />
        <span className="recent-workspace-name">
          {workspace.name}
          {isDefault && <span className="recent-workspace-default">✦</span>}
        </span>
      </button>
      <button
        className="recent-workspace-star"
        onClick={(e) => {
          e.stopPropagation();
          onSetDefault();
        }}
        title={isDefault ? "Remove as default" : "Set as default"}
      >
        {isDefault ? <StarFilledIcon /> : <StarIcon />}
      </button>
    </div>
  );
}

// Icons
function ChevronDownIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 0.15s ease",
      }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
    >
      <path d="M20 6h-8l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2z" />
    </svg>
  );
}

function FolderPlusIcon() {
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
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function StarFilledIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default RecentWorkspacesMenu;
