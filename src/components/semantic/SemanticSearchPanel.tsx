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
import { X, Search, Brain, File } from "lucide-react";

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
      <div className="semantic-search-panel">
        <div className="semantic-search-header">
          <h3 className="semantic-search-title">
            <Brain className="h-4 w-4 semantic-search-brain-icon" />
            Semantic Search
          </h3>
          <button
            className="semantic-search-close"
            onClick={onClose}
            title="Close (Escape)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="semantic-search-empty">
          <Brain className="h-8 w-8" />
          <p className="semantic-search-empty-title">Semantic search is disabled</p>
          <p className="semantic-search-empty-hint">
            Enable it in Settings to search by meaning
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="semantic-search-panel">
      {/* Header */}
      <div className="semantic-search-header">
        <h3 className="semantic-search-title">
          <Brain className="h-4 w-4 semantic-search-brain-icon" />
          Semantic Search
        </h3>
        <button
          className="semantic-search-close"
          onClick={onClose}
          title="Close (Escape)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search input */}
      <div className="semantic-search-inputs">
        <div className="semantic-search-input-row">
          <div className="semantic-search-input-group">
            <Search className="h-3.5 w-3.5 semantic-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="semantic-search-input"
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
        <div className="semantic-search-summary">
          {results.length > 0 ? (
            <span>
              {results.length} result{results.length !== 1 ? "s" : ""} found
            </span>
          ) : searchError ? (
            <span className="semantic-search-error">{searchError}</span>
          ) : (
            <span className="semantic-search-no-results">No results found</span>
          )}
        </div>
      )}

      {/* Results list */}
      <div className="semantic-search-results">
        {results.map((result, index) => (
          <button
            key={`${result.filePath}-${index}`}
            type="button"
            className="semantic-search-result"
            onClick={() => handleResultClick(result.filePath)}
          >
            <div className="semantic-search-result-header">
              <File className="h-3 w-3 semantic-search-file-icon" />
              <span className="semantic-search-result-name">
                {getDisplayName(result.filePath)}
              </span>
              <span className="semantic-search-result-score">
                {formatScore(result.score)}
              </span>
            </div>
            <div className="semantic-search-result-path">
              {getDisplayPath(result.filePath)}
            </div>
            {result.chunkText && (
              <div className="semantic-search-result-preview">
                {result.chunkText.slice(0, 150)}
                {result.chunkText.length > 150 && "..."}
              </div>
            )}
          </button>
        ))}

        {/* Empty state */}
        {query.length < 3 && (
          <div className="semantic-search-empty">
            <Brain className="h-8 w-8" />
            <p className="semantic-search-empty-title">Search by meaning</p>
            <p className="semantic-search-empty-hint">
              Type at least 3 characters to find related content
            </p>
          </div>
        )}

        {/* Model loading state */}
        {!modelLoaded && enabled && (
          <div className="semantic-search-empty">
            <LoadingSpinner />
            <p className="semantic-search-empty-title">Loading model...</p>
            <p className="semantic-search-empty-hint">
              This may take a moment on first use
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return <div className="semantic-search-spinner" />;
}

export default SemanticSearchPanel;
