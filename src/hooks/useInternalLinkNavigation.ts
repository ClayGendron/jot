/**
 * Hook for handling internal link navigation
 *
 * Detects clicks on internal links and triggers navigation to the target file.
 */

import { useCallback, useEffect } from "react";
import { useWorkspaceStore, selectAllFilesForSuggestion } from "@/stores/workspaceStore";
import { useEditorStore } from "@/stores/editorStore";
import { resolveInternalLink, isInternalLink, isSameFileHeadingLink } from "@/lib/links/resolver";

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
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const files = useWorkspaceStore(selectAllFilesForSuggestion);
  const currentFilePath = useEditorStore((state) => state.filePath);

  // Convert SuggestionFile[] to FileInfo[] for resolver
  const fileInfos = files.map((f) => ({
    name: f.name,
    path: f.path,
  }));

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
