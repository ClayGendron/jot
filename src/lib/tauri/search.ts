import { invoke } from "@tauri-apps/api/core";

/**
 * A single match within a search result
 */
export interface SearchMatch {
  /** 1-indexed line number */
  lineNumber: number;
  /** The line content containing the match */
  lineContent: string;
  /** Start index of match within lineContent */
  matchStart: number;
  /** End index of match within lineContent */
  matchEnd: number;
  /** Line before the match (for context) */
  contextBefore: string | null;
  /** Line after the match (for context) */
  contextAfter: string | null;
}

/**
 * Search results for a single file
 */
export interface FileSearchResult {
  /** Full path to the file */
  filePath: string;
  /** File name only */
  fileName: string;
  /** All matches in this file */
  matches: SearchMatch[];
}

/**
 * Raw match from Rust (snake_case)
 */
interface RawSearchMatch {
  line_number: number;
  line_content: string;
  match_start: number;
  match_end: number;
  context_before: string | null;
  context_after: string | null;
}

/**
 * Raw result from Rust (snake_case)
 */
interface RawFileSearchResult {
  file_path: string;
  file_name: string;
  matches: RawSearchMatch[];
}

/**
 * Convert raw snake_case result to camelCase
 */
function convertResult(raw: RawFileSearchResult): FileSearchResult {
  return {
    filePath: raw.file_path,
    fileName: raw.file_name,
    matches: raw.matches.map((m) => ({
      lineNumber: m.line_number,
      lineContent: m.line_content,
      matchStart: m.match_start,
      matchEnd: m.match_end,
      contextBefore: m.context_before,
      contextAfter: m.context_after,
    })),
  };
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Search term or regex pattern */
  searchTerm: string;
  /** Whether to match case */
  caseSensitive?: boolean;
  /** Whether to use regex */
  useRegex?: boolean;
  /** Glob pattern to filter files (e.g., "docs/*.md") */
  pathFilter?: string;
}

/**
 * Search all markdown files in the workspace
 *
 * @param workspacePath - Root path of the workspace
 * @param options - Search options
 * @returns Array of search results grouped by file
 */
export async function searchWorkspace(
  workspacePath: string,
  options: SearchOptions
): Promise<FileSearchResult[]> {
  const rawResults = await invoke<RawFileSearchResult[]>("jot_search_workspace", {
    workspacePath,
    searchTerm: options.searchTerm,
    caseSensitive: options.caseSensitive ?? false,
    useRegex: options.useRegex ?? false,
    pathFilter: options.pathFilter ?? null,
  });

  return rawResults.map(convertResult);
}

/**
 * Get total match count from search results
 */
export function getTotalMatchCount(results: FileSearchResult[]): number {
  return results.reduce((total, file) => total + file.matches.length, 0);
}
