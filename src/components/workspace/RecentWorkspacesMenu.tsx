import { useMemo } from "react";
import { Folder, FolderPlus, Star, ChevronDown } from "lucide-react";
import type { RecentWorkspace } from "@/lib/settings/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";

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
  // Filter out current workspace from the list
  const otherWorkspaces = useMemo(
    () => recentWorkspaces.filter((w) => w.path !== currentWorkspacePath),
    [recentWorkspaces, currentWorkspacePath]
  );

  const hasOtherWorkspaces = otherWorkspaces.length > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-xs"
            title="Recent workspaces (⇧⌘O)"
          />
        }
      >
        <ChevronDown className="size-4" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="min-w-[220px]">
        {/* Section: Recent Workspaces */}
        {hasOtherWorkspaces && (
          <>
            <DropdownMenuLabel>Recent</DropdownMenuLabel>
            {otherWorkspaces.map((workspace) => {
              const isDefault = workspace.path === defaultWorkspacePath;
              return (
                <div
                  key={workspace.path}
                  className="flex items-center group"
                >
                  <DropdownMenuItem
                    className="flex-1"
                    onClick={() => onOpenWorkspace(workspace.path)}
                  >
                    <Folder className="size-4" />
                    <span className="truncate flex-1">
                      {workspace.name}
                      {isDefault && (
                        <span className="ml-1 text-primary">✦</span>
                      )}
                    </span>
                  </DropdownMenuItem>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSetDefault(isDefault ? null : workspace.path);
                    }}
                    title={isDefault ? "Remove as default" : "Set as default"}
                    className="mr-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {isDefault ? (
                      <Star className="size-3.5 fill-current text-primary" />
                    ) : (
                      <Star className="size-3.5" />
                    )}
                  </Button>
                </div>
              );
            })}
            <DropdownMenuSeparator />
          </>
        )}

        {/* Open folder action */}
        <DropdownMenuItem onClick={onOpenFolder}>
          <FolderPlus className="size-4" />
          <span>Open Folder...</span>
          <DropdownMenuShortcut>⌘O</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default RecentWorkspacesMenu;
