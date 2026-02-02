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
            <BrainIcon />
            Semantic Search
          </h3>
          <button
            className="semantic-search-close"
            onClick={onClose}
            title="Close (Escape)"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="semantic-search-empty">
          <BrainEmptyIcon />
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
          <BrainIcon />
          Semantic Search
        </h3>
        <button
          className="semantic-search-close"
          onClick={onClose}
          title="Close (Escape)"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Search input */}
      <div className="semantic-search-inputs">
        <div className="semantic-search-input-row">
          <div className="semantic-search-input-group">
            <SearchIcon />
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
              <FileIcon />
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
            <BrainEmptyIcon />
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

// Icons

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="semantic-search-icon"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="semantic-search-brain-icon"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

function BrainEmptyIcon() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  );
}

function LoadingSpinner() {
  return <div className="semantic-search-spinner" />;
}

function FileIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="semantic-search-file-icon"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export default SemanticSearchPanel;
