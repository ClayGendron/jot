/**
 * SemanticSearchPanel Component
 *
 * Search panel for semantic (meaning-based) search across indexed folders.
 * Aesthetic: Editorial catalog - understated elegance matching
 * the GlobalSearchPanel's archival museum aesthetic.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useSemanticSearchStore } from "@/stores/semanticSearchStore";
import { semanticSearch } from "@/lib/tauri/semantic";
import type { SemanticSearchResult } from "@/lib/semantic/types";
import { X, Search, Brain, File, Loader2 } from "lucide-react";

interface SemanticSearchPanelProps {
  onResultClick: (filePath: string) => void;
  onClose: () => void;
}

export function SemanticSearchPanel({
  onResultClick,
  onClose,
}: SemanticSearchPanelProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Store state
  const enabled = useSemanticSearchStore((s) => s.enabled);
  const modelLoaded = useSemanticSearchStore((s) => s.modelLoaded);
  const indexedFolders = useSemanticSearchStore((s) => s.indexedFolders);

  // Local state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SemanticSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
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

    if (!query || query.length < 3) {
      setResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    if (!enabled || !modelLoaded) {
      setSearchError("Semantic search is not enabled");
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    debounceRef.current = setTimeout(async () => {
      // Generate unique request ID for this search
      const requestId = crypto.randomUUID();
      activeRequestRef.current = requestId;

      try {
        const searchResults = await semanticSearch(query, 20);

        // Ignore stale results from superseded requests
        if (activeRequestRef.current !== requestId) {
          return;
        }

        setResults(searchResults);
        setIsSearching(false);
      } catch (err) {
        // Ignore errors from stale requests
        if (activeRequestRef.current !== requestId) {
          return;
        }
        setSearchError(err instanceof Error ? err.message : "Search failed");
        setResults([]);
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, enabled, modelLoaded]);

  // Handle result click
  const handleResultClick = useCallback(
    (filePath: string) => {
      onResultClick(filePath);
    },
    [onResultClick]
  );

  // Get display name from file path
  const getDisplayName = useCallback((filePath: string) => {
    const parts = filePath.split("/");
    return parts[parts.length - 1].replace(/\.md$/, "");
  }, []);

  // Get relative path for display
  const getDisplayPath = useCallback(
    (filePath: string) => {
      // Find which indexed folder this file belongs to
      for (const folder of indexedFolders) {
        if (filePath.startsWith(folder.path)) {
          const relativePath = filePath.slice(folder.path.length + 1);
          return relativePath;
        }
      }
      return filePath;
    },
    [indexedFolders]
  );

  // Format similarity score as percentage
  const formatScore = useCallback((score: number) => {
    return `${Math.round(score * 100)}%`;
  }, []);

  // Not enabled state
  if (!enabled) {
    return (
      <div className="fixed top-0 right-0 bottom-0 w-[360px] z-[100] flex flex-col bg-[var(--color-paper)] border-l border-[var(--color-border)] shadow-[-4px_0_20px_rgba(0,0,0,0.08)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="flex items-center gap-2 font-sans text-sm font-semibold text-[var(--color-ink)] m-0">
            <Brain className="h-4 w-4 text-[var(--color-accent)]" />
            Semantic Search
          </h3>
          <button
            className="flex items-center justify-center w-7 h-7 border-none bg-transparent rounded text-[var(--color-ink-light)] cursor-pointer transition-colors hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
            onClick={onClose}
            title="Close (Escape)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-[var(--color-ink-muted)]">
          <Brain className="h-8 w-8 mb-4 opacity-50" />
          <p className="font-sans text-sm font-medium text-[var(--color-ink-light)] m-0 mb-1">Semantic search is disabled</p>
          <p className="font-sans text-[0.8125rem] text-[var(--color-ink-muted)] m-0">
            Enable it in Settings to search by meaning
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[360px] z-[100] flex flex-col bg-[var(--color-paper)] border-l border-[var(--color-border)] shadow-[-4px_0_20px_rgba(0,0,0,0.08)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="flex items-center gap-2 font-sans text-sm font-semibold text-[var(--color-ink)] m-0">
          <Brain className="h-4 w-4 text-[var(--color-accent)]" />
          Semantic Search
        </h3>
        <button
          className="flex items-center justify-center w-7 h-7 border-none bg-transparent rounded text-[var(--color-ink-light)] cursor-pointer transition-colors hover:bg-[var(--color-paper-warm)] hover:text-[var(--color-ink)]"
          onClick={onClose}
          title="Close (Escape)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search input */}
      <div className="px-4 py-3 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="flex items-center flex-1 gap-1.5 px-2.5 py-2 bg-[var(--color-paper-warm)] border border-[var(--color-border)] rounded-md transition-colors focus-within:border-[var(--color-accent)] focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)]">
            <Search className="h-3.5 w-3.5 text-[var(--color-ink-muted)] shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              className="flex-1 border-none bg-transparent font-sans text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-muted)]"
              placeholder="Search by meaning..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {isSearching && <LoadingSpinner />}
          </div>
        </div>
      </div>

      {/* Results summary */}
      {query.length >= 3 && !isSearching && (
        <div className="px-4 py-2 font-sans text-xs text-[var(--color-ink-muted)] bg-[var(--color-paper-warm)] border-b border-[var(--color-border)]">
          {results.length > 0 ? (
            <span>
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </span>
          ) : searchError ? (
            <span className="text-[var(--color-error)]">{searchError}</span>
          ) : (
            <span className="italic">No results found</span>
          )}
        </div>
      )}

      {/* Results list */}
      <div className="flex-1 overflow-y-auto py-2">
        {results.map((result, index) => (
          <button
            key={`${result.filePath}-${index}`}
            type="button"
            className="w-full px-4 py-2.5 border-none bg-transparent text-left cursor-pointer transition-colors hover:bg-[var(--color-paper-warm)]"
            onClick={() => handleResultClick(result.filePath)}
          >
            <div className="flex items-center gap-2">
              <File className="h-3 w-3 text-[var(--color-ink-muted)] shrink-0" />
              <span className="flex-1 font-sans text-sm font-medium text-[var(--color-ink)] overflow-hidden text-ellipsis whitespace-nowrap">
                {getDisplayName(result.filePath)}
              </span>
              <span className="font-mono text-[0.6875rem] text-[var(--color-accent)] font-medium px-1.5 py-0.5 bg-[var(--color-accent-soft)] rounded">
                {formatScore(result.score)}
              </span>
            </div>
            <div className="font-sans text-xs text-[var(--color-ink-muted)] mt-1 overflow-hidden text-ellipsis whitespace-nowrap">
              {getDisplayPath(result.filePath)}
            </div>
            {result.chunkText && (
              <div className="font-sans text-xs text-[var(--color-ink-light)] mt-1.5 leading-relaxed line-clamp-2">
                {result.chunkText.slice(0, 150)}
                {result.chunkText.length > 150 && "..."}
              </div>
            )}
          </button>
        ))}

        {/* Empty state */}
        {query.length < 3 && (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-[var(--color-ink-muted)]">
            <Brain className="h-8 w-8 mb-4 opacity-50" />
            <p className="font-sans text-sm font-medium text-[var(--color-ink-light)] m-0 mb-1">Search by meaning</p>
            <p className="font-sans text-[0.8125rem] text-[var(--color-ink-muted)] m-0">
              Type at least 3 characters to find related content
            </p>
          </div>
        )}

        {/* Model loading state */}
        {!modelLoaded && enabled && (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center text-[var(--color-ink-muted)]">
            <LoadingSpinner />
            <p className="font-sans text-sm font-medium text-[var(--color-ink-light)] m-0 mb-1 mt-4">Loading model...</p>
            <p className="font-sans text-[0.8125rem] text-[var(--color-ink-muted)] m-0">
              This may take a moment on first use
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <Loader2 className="h-3.5 w-3.5 text-[var(--color-accent)] animate-spin" />;
}

export default SemanticSearchPanel;
