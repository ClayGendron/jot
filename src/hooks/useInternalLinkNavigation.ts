/**
 * Hook for handling internal link navigation
 *
 * Detects clicks on internal links and triggers navigation to the target file.
 */

import { useCallback, useEffect, useMemo } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useEditorStore } from "@/stores/editorStore";
import { resolveInternalLink, isInternalLink, isSameFileHeadingLink } from "@/lib/links/resolver";
import { isWithinWorkspace, shouldScrollOnly } from "@/lib/links/linkService";
import { joinFsPaths } from "@/lib/path/pathUtils";
import type { FileEntry } from "@/lib/tauri/files";

export interface UseInternalLinkNavigationOptions {
  /** Callback when an internal link is clicked (for cross-file navigation) */
  onNavigate: (path: string, heading?: string) => void;
  /** Callback when a same-file heading link is clicked - just scroll, don't reload file */
  onScrollToHeading?: (heading: string) => void;
  /** Callback when a broken link is clicked - receives the intended file path */
  onBrokenLinkClick?: (intendedPath: string) => void;
  /** Container element to listen for clicks */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Whether navigation is enabled */
  enabled?: boolean;
  /** Current file path - used to detect same-file navigation with explicit filename */
  currentFilePath?: string | null;
}

export interface UseInternalLinkNavigationResult {
  /** Handle a link click event (async for path resolution on Windows) */
  handleLinkClick: (href: string) => Promise<void>;
}

/**
 * Hook for internal link navigation
 */
export function useInternalLinkNavigation({
  onNavigate,
  onScrollToHeading,
  onBrokenLinkClick,
  containerRef,
  enabled = true,
  currentFilePath,
}: UseInternalLinkNavigationOptions): UseInternalLinkNavigationResult {
  // Use individual selectors to avoid React 19 + Zustand snapshot caching issues
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const fileTree = useWorkspaceStore((state) => state.fileTree);
  const isCaseSensitiveFs = useEditorStore((state) => state.isCaseSensitiveFs);

  // Derive file list from fileTree using useMemo for stable references
  const fileInfos = useMemo(() => {
    const result: Array<{ name: string; path: string }> = [];
    const collectFiles = (entries: FileEntry[]) => {
      for (const entry of entries) {
        if (entry.is_markdown) {
          result.push({ name: entry.name, path: entry.path });
        }
        if (entry.children) {
          collectFiles(entry.children);
        }
      }
    };
    collectFiles(fileTree);
    return result;
  }, [fileTree]);

  const handleLinkClick = useCallback(
    async (href: string) => {
      // Handle same-file heading links (#heading)
      if (isSameFileHeadingLink(href)) {
        const heading = href.slice(1); // Remove the leading #

        // Use the dedicated scroll callback if provided (avoids file reload)
        if (onScrollToHeading) {
          onScrollToHeading(heading);
          return;
        }

        // Fallback: scroll directly to the heading element
        const headingElement = document.getElementById(heading);
        if (headingElement) {
          headingElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
      }

      // Handle cross-file internal links
      if (!workspacePath || !isInternalLink(href)) {
        return;
      }

      const resolved = resolveInternalLink(href, workspacePath, fileInfos, isCaseSensitiveFs);

      if (resolved.exists && resolved.resolvedPath) {
        // Check if this is same-file navigation (e.g., "currentfile.md#section")
        // In this case, just scroll instead of reloading the file
        if (currentFilePath && shouldScrollOnly(resolved.resolvedPath, currentFilePath, resolved.heading)) {
          if (resolved.heading && onScrollToHeading) {
            onScrollToHeading(resolved.heading);
          }
          return;
        }
        onNavigate(resolved.resolvedPath, resolved.heading);
      } else {
        // File doesn't exist - offer to create it
        // Build the intended path from href using proper path joining for UNC/Windows support
        const pathWithoutAnchor = href.split("#")[0];
        const intendedPath = pathWithoutAnchor.startsWith("/")
          ? pathWithoutAnchor
          : await joinFsPaths(workspacePath, pathWithoutAnchor);

        // Security check: validate path is within workspace (prevent path traversal)
        if (!isWithinWorkspace(intendedPath, workspacePath, isCaseSensitiveFs)) {
          console.warn(`Blocked path traversal attempt: ${href}`);
          return;
        }

        if (onBrokenLinkClick) {
          onBrokenLinkClick(intendedPath);
        } else {
          console.warn(`Internal link target not found: ${href}`);
        }
      }
    },
    [workspacePath, fileInfos, isCaseSensitiveFs, onNavigate, onScrollToHeading, onBrokenLinkClick, currentFilePath]
  );

  // Click event listener for the container
  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest("a[data-internal-link]") as HTMLAnchorElement | null;

      if (!link) return;

      // Prevent default navigation
      event.preventDefault();
      event.stopPropagation();

      const href = link.getAttribute("href");
      if (href) {
        // Catch promise rejections to avoid unhandled rejection errors
        handleLinkClick(href).catch((err) => {
          console.error("Failed to handle link click:", err);
        });
      }
    };

    const container = containerRef.current;
    container.addEventListener("click", handleClick);

    return () => {
      container.removeEventListener("click", handleClick);
    };
  }, [enabled, containerRef, handleLinkClick]);

  return { handleLinkClick };
}

export default useInternalLinkNavigation;
