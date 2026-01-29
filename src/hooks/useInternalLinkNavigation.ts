/**
 * Hook for handling internal link navigation
 *
 * Detects clicks on internal links and triggers navigation to the target file.
 */

import { useCallback, useEffect } from "react";
import { useWorkspaceStore, selectAllFilesForSuggestion } from "@/stores/workspaceStore";
import { resolveInternalLink, isInternalLink } from "@/lib/links/resolver";

export interface UseInternalLinkNavigationOptions {
  /** Callback when an internal link is clicked */
  onNavigate: (path: string, heading?: string) => void;
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
  containerRef,
  enabled = true,
}: UseInternalLinkNavigationOptions): UseInternalLinkNavigationResult {
  const workspacePath = useWorkspaceStore((state) => state.workspacePath);
  const files = useWorkspaceStore(selectAllFilesForSuggestion);

  // Convert SuggestionFile[] to FileInfo[] for resolver
  const fileInfos = files.map((f) => ({
    name: f.name,
    path: f.path,
  }));

  const handleLinkClick = useCallback(
    (href: string) => {
      if (!workspacePath || !isInternalLink(href)) {
        return;
      }

      const resolved = resolveInternalLink(href, workspacePath, fileInfos);

      if (resolved.exists && resolved.resolvedPath) {
        onNavigate(resolved.resolvedPath, resolved.heading);
      } else {
        // File doesn't exist - could prompt to create it (Phase 5)
        console.warn(`Internal link target not found: ${href}`);
      }
    },
    [workspacePath, fileInfos, onNavigate]
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
