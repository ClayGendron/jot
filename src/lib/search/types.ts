/**
 * Search System Types
 *
 * Defines the core interfaces for the search system, enabling future
 * extensibility for device-wide search and semantic search providers.
 */

/**
 * Represents a single match within a search result.
 * Uses UTF-16 code unit offsets for JavaScript string compatibility.
 */
export interface SearchMatch {
  /** Full path to the file containing the match, or null for in-document search */
  filePath: string | null;
  /** 1-indexed line number */
  lineNumber: number;
  /** The line content containing the match */
  lineContent: string;
  /** Start index of match within lineContent (UTF-16 code units) */
  matchStart: number;
  /** End index of match within lineContent (UTF-16 code units) */
  matchEnd: number;
  /** Optional context line before the match */
  contextBefore?: string;
  /** Optional context line after the match */
  contextAfter?: string;
}

/**
 * Options for configuring a search operation.
 */
export interface SearchOptions {
  /** The search query (literal or regex depending on useRegex) */
  query: string;
  /** Whether the search should be case-sensitive */
  caseSensitive: boolean;
  /** Whether to interpret query as a regular expression */
  useRegex: boolean;
  /** Optional glob pattern to filter which files to search */
  pathFilter?: string;
}

/**
 * Capabilities that a search provider can advertise.
 */
export interface SearchCapabilities {
  /** Whether the provider supports regex search */
  regex: boolean;
  /** Whether the provider supports case-sensitive search */
  caseSensitive: boolean;
  /** Whether the provider supports find-and-replace */
  replace: boolean;
  /** The scope of search this provider handles */
  scope: "document" | "workspace" | "device";
}

/**
 * Interface for search providers.
 *
 * This abstraction allows for multiple search implementations:
 * - Document search (in-editor TipTap search)
 * - Workspace search (current file tree via Tauri)
 * - Device-wide search (future: configurable paths)
 * - Semantic search (future: embedding-based search)
 *
 * @template T The return type of the search operation (defaults to SearchMatch[])
 */
export interface SearchProvider<T = SearchMatch[]> {
  /** The capabilities this provider supports */
  readonly capabilities: SearchCapabilities;

  /**
   * Perform a search operation.
   *
   * @param options Search configuration
   * @param signal Optional AbortSignal for cancellation
   * @returns Promise resolving to search results
   */
  search(options: SearchOptions, signal?: AbortSignal): Promise<T>;
}

/**
 * Result type for workspace/file-level search grouping matches by file.
 */
export interface FileSearchResult {
  /** Full path to the file */
  filePath: string;
  /** File name without path */
  fileName: string;
  /** All matches found in this file */
  matches: SearchMatch[];
}

/**
 * Extended search options for workspace/device search.
 */
export interface WorkspaceSearchOptions extends SearchOptions {
  /** Maximum number of files to search */
  maxFiles?: number;
  /** Maximum number of matches to return per file */
  maxMatchesPerFile?: number;
  /** Maximum total matches to return */
  maxTotalMatches?: number;
}
