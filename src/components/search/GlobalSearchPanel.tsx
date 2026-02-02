/**
 * GlobalSearchPanel Component
 *
 * Right-side panel for workspace-wide search.
 * Aesthetic: Editorial catalog - understated elegance matching
 * the VersionHistoryPanel's archival museum aesthetic.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  X,
  Search,
  ChevronRight,
  ChevronDown,
  File,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSearchStore } from "@/stores/searchStore";
import {
  searchWorkspace,
  getTotalMatchCount,
  type SearchMatch,
} from "@/lib/tauri/search";

interface GlobalSearchPanelProps {
  workspacePath: string;
  onResultClick: (filePath: string, lineNumber: number) => void;
  onClose: () => void;
}

export function GlobalSearchPanel({
  workspacePath,
  onResultClick,
  onClose,
}: GlobalSearchPanelProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Store state
  const searchTerm = useSearchStore((s) => s.globalSearchTerm);
  const caseSensitive = useSearchStore((s) => s.globalCaseSensitive);
  const useRegex = useSearchStore((s) => s.globalUseRegex);
  const pathFilter = useSearchStore((s) => s.globalPathFilter);
  const results = useSearchStore((s) => s.globalResults);
  const isSearching = useSearchStore((s) => s.globalIsSearching);

  const setSearchTerm = useSearchStore((s) => s.setGlobalSearchTerm);
  const toggleCaseSensitive = useSearchStore((s) => s.toggleGlobalCaseSensitive);
  const toggleUseRegex = useSearchStore((s) => s.toggleGlobalUseRegex);
  const setPathFilter = useSearchStore((s) => s.setGlobalPathFilter);
  const setResults = useSearchStore((s) => s.setGlobalResults);
  const setIsSearching = useSearchStore((s) => s.setGlobalIsSearching);

  // Local UI state
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [searchError, setSearchError] = useState<string | null>(null);

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Request ID for race condition prevention
  const activeRequestRef = useRef<string | null>(null);

  // Focus input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Perform search with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchTerm || searchTerm.length < 2) {
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    debounceRef.current = setTimeout(async () => {
      // Generate unique request ID for this search
      const requestId = crypto.randomUUID();
      activeRequestRef.current = requestId;

      try {
        const searchResults = await searchWorkspace(workspacePath, {
          searchTerm,
          caseSensitive,
          useRegex,
          pathFilter: pathFilter || undefined,
        });

        // Ignore stale results from superseded requests
        if (activeRequestRef.current !== requestId) {
          return;
        }

        // Convert to store format
        const storeResults = searchResults.map((r) => ({
          filePath: r.filePath,
          fileName: r.fileName,
          matches: r.matches.map((m) => ({
            lineNumber: m.lineNumber,
            lineContent: m.lineContent,
            matchStart: m.matchStart,
            matchEnd: m.matchEnd,
            contextBefore: m.contextBefore,
            contextAfter: m.contextAfter,
          })),
        }));

        setResults(storeResults);

        // Auto-expand files with few results
        const toExpand = new Set<string>();
        for (const r of storeResults) {
          if (r.matches.length <= 5) {
            toExpand.add(r.filePath);
          }
        }
        setExpandedFiles(toExpand);
      } catch (err) {
        // Ignore errors from stale requests
        if (activeRequestRef.current !== requestId) {
          return;
        }
        setSearchError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    searchTerm,
    caseSensitive,
    useRegex,
    pathFilter,
    workspacePath,
    setResults,
    setIsSearching,
  ]);

  // Computed values
  const totalMatches = useMemo(() => getTotalMatchCount(results), [results]);
  const fileCount = results.length;

  // Toggle file expansion
  const toggleFileExpanded = useCallback((filePath: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  }, []);

  // Handle result click
  const handleMatchClick = useCallback(
    (filePath: string, lineNumber: number) => {
      onResultClick(filePath, lineNumber);
    },
    [onResultClick]
  );

  // Get relative path for display
  const getDisplayPath = useCallback(
    (filePath: string) => {
      if (filePath.startsWith(workspacePath)) {
        return filePath.slice(workspacePath.length + 1);
      }
      return filePath;
    },
    [workspacePath]
  );

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[380px] z-[200] flex flex-col bg-[var(--color-paper)] border-l border-[var(--color-border)] shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="font-sans text-sm font-semibold text-[var(--color-ink)] m-0">Search</h3>
        <button
          className="flex items-center justify-center p-1 border-none bg-transparent rounded text-[var(--color-ink-light)] cursor-pointer transition-colors hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
          onClick={onClose}
          title="Close (Escape)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search inputs */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex items-center flex-1 gap-1.5 px-2.5 py-2 bg-[var(--color-paper-warm)] border border-[var(--color-border)] rounded-md transition-colors focus-within:border-[var(--color-accent)]">
            <Search className="h-3.5 w-3.5 text-[var(--color-ink-muted)] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              className="flex-1 border-none bg-transparent font-sans text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)]"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {isSearching && <LoadingSpinner />}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center px-2 py-1 border border-[var(--color-border)] bg-transparent rounded font-mono text-xs font-semibold text-[var(--color-ink-light)] cursor-pointer transition-colors",
              "hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]",
              caseSensitive && "bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-accent)]"
            )}
            onClick={toggleCaseSensitive}
            title="Case sensitive"
          >
            Aa
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center px-2 py-1 border border-[var(--color-border)] bg-transparent rounded font-mono text-xs font-semibold text-[var(--color-ink-light)] cursor-pointer transition-colors",
              "hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]",
              useRegex && "bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-accent)]"
            )}
            onClick={toggleUseRegex}
            title="Use regex"
          >
            .*
          </button>
          <div className="flex-1">
            <input
              type="text"
              className="w-full px-2 py-1 border border-[var(--color-border)] bg-transparent rounded font-mono text-xs text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-accent)] placeholder:text-[var(--color-ink-muted)]"
              placeholder="Path filter (e.g., docs/*.md)"
              value={pathFilter}
              onChange={(e) => setPathFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Results summary */}
      {searchTerm.length >= 2 && !isSearching && (
        <div className="px-4 py-2 font-sans text-xs text-[var(--color-ink-muted)] bg-[var(--color-paper-warm)] border-b border-[var(--color-border)]">
          {totalMatches > 0 ? (
            <span>
              {totalMatches} result{totalMatches !== 1 ? "s" : ""} in {fileCount}{" "}
              file{fileCount !== 1 ? "s" : ""}
            </span>
          ) : searchError ? (
            <span className="text-[#c45d3e]">{searchError}</span>
          ) : (
            <span className="italic">No results found</span>
          )}
        </div>
      )}

      {/* Results list */}
      <div className="flex-1 overflow-y-auto py-2">
        {results.map((file) => (
          <div key={file.filePath} className="mb-1">
            <button
              type="button"
              className="flex items-center w-full gap-1.5 px-4 py-2 border-none bg-transparent font-sans text-[0.8125rem] text-[var(--color-ink)] text-left cursor-pointer transition-colors hover:bg-[var(--color-paper-warm)]"
              onClick={() => toggleFileExpanded(file.filePath)}
            >
              <span className="text-[var(--color-ink-muted)] shrink-0">
                {expandedFiles.has(file.filePath) ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </span>
              <File className="h-3 w-3 text-[var(--color-ink-muted)] shrink-0" />
              <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                {getDisplayPath(file.filePath)}
              </span>
              <span className="px-1.5 py-0.5 bg-[var(--color-paper-warm)] rounded-full font-mono text-[0.6875rem] text-[var(--color-ink-muted)]">
                {file.matches.length}
              </span>
            </button>

            {expandedFiles.has(file.filePath) && (
              <div className="pl-6">
                {file.matches.map((match, idx) => (
                  <button
                    key={`${file.filePath}-${match.lineNumber}-${idx}`}
                    type="button"
                    className="flex items-start w-full gap-2 px-4 py-1.5 border-none bg-transparent font-mono text-xs text-[var(--color-ink)] text-left cursor-pointer transition-colors hover:bg-[var(--color-paper-warm)]"
                    onClick={() =>
                      handleMatchClick(file.filePath, match.lineNumber)
                    }
                  >
                    <span className="shrink-0 text-[var(--color-ink-muted)] min-w-10">
                      L{match.lineNumber}
                    </span>
                    <MatchPreview match={match} />
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Empty state */}
        {searchTerm.length < 2 && (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-[var(--color-ink-muted)]">
            <Search className="h-8 w-8 mb-4 opacity-50" strokeWidth={1.5} />
            <p className="font-sans text-sm font-medium text-[var(--color-ink-light)] m-0 mb-1">Search your workspace</p>
            <p className="font-sans text-[0.8125rem] text-[var(--color-ink-muted)] m-0">
              Type at least 2 characters to search
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Match preview with highlighted search term
 */
function MatchPreview({ match }: { match: SearchMatch }) {
  const { lineContent, matchStart, matchEnd } = match;

  // Truncate long lines around the match
  const maxContextLength = 40;
  const displayStart = Math.max(0, matchStart - maxContextLength);
  const displayEnd = Math.min(lineContent.length, matchEnd + maxContextLength);

  const before = lineContent.slice(displayStart, matchStart);
  const matched = lineContent.slice(matchStart, matchEnd);
  const after = lineContent.slice(matchEnd, displayEnd);

  return (
    <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap leading-relaxed">
      {displayStart > 0 && <span className="text-[var(--color-ink-muted)]">…</span>}
      <span className="text-[var(--color-ink-light)]">{before}</span>
      <mark className="bg-[var(--color-highlight)] text-[var(--color-ink)] px-0.5 rounded-sm font-semibold">{matched}</mark>
      <span className="text-[var(--color-ink-light)]">{after}</span>
      {displayEnd < lineContent.length && (
        <span className="text-[var(--color-ink-muted)]">…</span>
      )}
    </span>
  );
}

// Helper components

function LoadingSpinner() {
  return <Loader2 className="h-3.5 w-3.5 text-[var(--color-accent)] animate-spin" />;
}

export default GlobalSearchPanel;
