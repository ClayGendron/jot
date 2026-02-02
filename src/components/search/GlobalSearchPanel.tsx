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
} from "lucide-react";
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
    <div className="global-search-panel">
      {/* Header */}
      <div className="global-search-header">
        <h3 className="global-search-title">Search</h3>
        <button
          className="global-search-close"
          onClick={onClose}
          title="Close (Escape)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search inputs */}
      <div className="global-search-inputs">
        <div className="global-search-input-row">
          <div className="global-search-input-group">
            <Search className="h-3.5 w-3.5 global-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="global-search-input"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {isSearching && <LoadingSpinner />}
          </div>
        </div>

        <div className="global-search-options-row">
          <button
            type="button"
            className={`global-search-toggle ${caseSensitive ? "active" : ""}`}
            onClick={toggleCaseSensitive}
            title="Case sensitive"
          >
            Aa
          </button>
          <button
            type="button"
            className={`global-search-toggle ${useRegex ? "active" : ""}`}
            onClick={toggleUseRegex}
            title="Use regex"
          >
            .*
          </button>
          <div className="global-search-path-filter">
            <input
              type="text"
              className="global-search-path-input"
              placeholder="Path filter (e.g., docs/*.md)"
              value={pathFilter}
              onChange={(e) => setPathFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Results summary */}
      {searchTerm.length >= 2 && !isSearching && (
        <div className="global-search-summary">
          {totalMatches > 0 ? (
            <span>
              {totalMatches} result{totalMatches !== 1 ? "s" : ""} in {fileCount}{" "}
              file{fileCount !== 1 ? "s" : ""}
            </span>
          ) : searchError ? (
            <span className="global-search-error">{searchError}</span>
          ) : (
            <span className="global-search-no-results">No results found</span>
          )}
        </div>
      )}

      {/* Results list */}
      <div className="global-search-results">
        {results.map((file) => (
          <div key={file.filePath} className="global-search-file">
            <button
              type="button"
              className="global-search-file-header"
              onClick={() => toggleFileExpanded(file.filePath)}
            >
              <span className="global-search-file-chevron">
                {expandedFiles.has(file.filePath) ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </span>
              <File className="h-3 w-3 global-search-file-icon" />
              <span className="global-search-file-path">
                {getDisplayPath(file.filePath)}
              </span>
              <span className="global-search-match-count">
                {file.matches.length}
              </span>
            </button>

            {expandedFiles.has(file.filePath) && (
              <div className="global-search-matches">
                {file.matches.map((match, idx) => (
                  <button
                    key={`${file.filePath}-${match.lineNumber}-${idx}`}
                    type="button"
                    className="global-search-match"
                    onClick={() =>
                      handleMatchClick(file.filePath, match.lineNumber)
                    }
                  >
                    <span className="global-search-line-num">
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
          <div className="global-search-empty">
            <Search className="h-8 w-8" strokeWidth={1.5} />
            <p className="global-search-empty-title">Search your workspace</p>
            <p className="global-search-empty-hint">
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
    <span className="global-search-match-text">
      {displayStart > 0 && <span className="global-search-ellipsis">…</span>}
      <span className="global-search-context">{before}</span>
      <mark className="global-search-highlight">{matched}</mark>
      <span className="global-search-context">{after}</span>
      {displayEnd < lineContent.length && (
        <span className="global-search-ellipsis">…</span>
      )}
    </span>
  );
}

// Helper components

function LoadingSpinner() {
  return <div className="global-search-spinner" />;
}

export default GlobalSearchPanel;
