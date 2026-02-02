import { useState, useRef, useEffect, useMemo } from "react";
import { Folder, FolderPlus, Star, ChevronDown } from "lucide-react";
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
        <ChevronDown
          className="h-4 w-4 transition-transform duration-150"
          style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
        />
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
            <FolderPlus className="h-4 w-4" />
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
        <Folder className="h-4 w-4" />
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
        {isDefault ? <Star className="h-4 w-4 fill-current" /> : <Star className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default RecentWorkspacesMenu;
