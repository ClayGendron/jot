/**
 * Hook for handling internal link navigation
 *
 * Detects clicks on internal links and triggers navigation to the target file.
 */

import { useCallback, useEffect, useMemo } from "react";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useEditorStore } from "@/stores/editorStore";
import { resolveInternalLink, isInternalLink, isSameFileHeadingLink } from "@/lib/links/resolver";
import type { FileEntry } from "@/lib/tauri/files";

export interface UseInternalLinkNavigationOptions {
  /** Callback when an internal link is clicked */
  onNavigate: (path: string, heading?: string) => void;
  /** Callback when a broken link is clicked - receives the intended file path */
  onBrokenLinkClick?: (intendedPath: string) => void;
  /** Container element to listen for clicks */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Whether navigation is enabled */
  enabled?: boolean;
}

export interface UseInternalLinkNavigationResult {
  /** Handle a link click event */
  handleLinkClick: (href: string) => void;
}

/**
 * Hook for internal link navigation
 */
export function useInternalLinkNavigation({
  onNavigate,
  onBrokenLinkClick,
  containerRef,
  enabled = true,
}: UseInternalLinkNavigationOptions): UseInternalLinkNavigationResult {
  // Use individual selectors to avoid React 19 + Zustand snapshot caching issues
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const fileTree = useWorkspaceStore((state) => state.fileTree);
  const currentFilePath = useEditorStore((state) => state.filePath);

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
    (href: string) => {
      // Handle same-file heading links (#heading)
      if (isSameFileHeadingLink(href)) {
        const heading = href.slice(1); // Remove the leading #
        if (currentFilePath) {
          // Navigate to the same file with heading
          onNavigate(currentFilePath, heading);
        } else {
          // No current file, just scroll to the heading element directly
          const headingElement = document.getElementById(heading);
          if (headingElement) {
            headingElement.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
        return;
      }

      // Handle cross-file internal links
      if (!workspacePath || !isInternalLink(href)) {
        return;
      }

      const resolved = resolveInternalLink(href, workspacePath, fileInfos);

      if (resolved.exists && resolved.resolvedPath) {
        onNavigate(resolved.resolvedPath, resolved.heading);
      } else {
        // File doesn't exist - offer to create it
        // Build the intended path from href
        const pathWithoutAnchor = href.split("#")[0];
        const intendedPath = pathWithoutAnchor.startsWith("/")
          ? pathWithoutAnchor
          : `${workspacePath}/${pathWithoutAnchor}`;

        if (onBrokenLinkClick) {
          onBrokenLinkClick(intendedPath);
        } else {
          console.warn(`Internal link target not found: ${href}`);
        }
      }
    },
    [workspacePath, fileInfos, onNavigate, onBrokenLinkClick, currentFilePath]
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
        handleLinkClick(href);
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
