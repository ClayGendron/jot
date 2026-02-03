/**
 * CodeMirror 6 Search Extension
 *
 * Provides programmatic search and replace functionality using @codemirror/search.
 * Designed to integrate with the existing FindReplaceBar and searchStore.
 *
 * Features:
 * - Find all matches with highlighting
 * - Navigate between results (next/previous)
 * - Replace single or all matches
 * - Case sensitivity and regex modes
 * - Match count and current match index tracking
 */

import { StateField, StateEffect, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  SearchQuery,
  search,
  getSearchQuery,
  setSearchQuery as cmSetSearchQuery,
  findNext as cmFindNext,
  findPrevious as cmFindPrevious,
  replaceNext as cmReplaceNext,
  replaceAll as cmReplaceAll,
} from "@codemirror/search";

/**
 * Query parameters for search
 */
export interface SearchQueryParams {
  search: string;
  replace?: string;
  caseSensitive?: boolean;
  regexp?: boolean;
  wholeWord?: boolean;
}

/**
 * Current search state
 */
export interface SearchState {
  search: string;
  replace: string;
  caseSensitive: boolean;
  regexp: boolean;
  matchCount: number;
  currentMatch: number;
}

/**
 * Effect to update match info in our custom state
 */
const updateMatchInfo = StateEffect.define<{ count: number; current: number }>();

/**
 * State field to track match count and current match
 * We use a separate field because @codemirror/search doesn't expose these directly
 */
const matchInfoField = StateField.define<{ count: number; current: number }>({
  create() {
    return { count: 0, current: 0 };
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(updateMatchInfo)) {
        return effect.value;
      }
    }
    return value;
  },
});

/**
 * Count matches in the document
 */
function countMatches(view: EditorView, query: SearchQuery): number {
  if (!query.valid) return 0;

  let count = 0;
  const doc = view.state.doc;
  let cursor = query.getCursor(doc);
  let match = cursor.next();

  while (!match.done) {
    count++;
    match = cursor.next();
  }

  return count;
}

/**
 * Find current match index based on cursor position
 */
function findCurrentMatchIndex(
  view: EditorView,
  query: SearchQuery,
  cursorPos: number
): number {
  if (!query.valid) return 0;

  const doc = view.state.doc;
  let cursor = query.getCursor(doc);
  let match = cursor.next();
  let index = 0;

  while (!match.done) {
    index++;
    if (match.value.from >= cursorPos) {
      return index;
    }
    match = cursor.next();
  }

  // If cursor is after all matches, return the count (wrapped)
  return index > 0 ? 1 : 0;
}

/**
 * Update match info after search state changes
 */
function updateMatchInfoFromQuery(view: EditorView) {
  const query = getSearchQuery(view.state);
  const count = countMatches(view, query);
  const current =
    count > 0 ? findCurrentMatchIndex(view, query, view.state.selection.main.from) : 0;

  view.dispatch({
    effects: updateMatchInfo.of({ count, current }),
  });
}

/**
 * Create the search extension with custom configuration
 */
export function createSearchExtension(): Extension {
  return [
    // Use CM6's built-in search infrastructure
    search({
      // We handle the panel ourselves via FindReplaceBar
      top: false,
    }),
    matchInfoField,
    // Update match info on selection changes
    EditorView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        const query = getSearchQuery(update.state);
        if (query.valid) {
          // Defer update to avoid state update during state computation
          setTimeout(() => updateMatchInfoFromQuery(update.view), 0);
        }
      }
    }),
  ];
}

/**
 * Set the search query programmatically
 */
export function setSearchQuery(view: EditorView, params: SearchQueryParams): void {
  const query = new SearchQuery({
    search: params.search,
    replace: params.replace ?? "",
    caseSensitive: params.caseSensitive ?? false,
    regexp: params.regexp ?? false,
    wholeWord: params.wholeWord ?? false,
  });

  view.dispatch({
    effects: cmSetSearchQuery.of(query),
  });

  // Update our match info
  const count = countMatches(view, query);
  const current = count > 0 ? 1 : 0;

  view.dispatch({
    effects: updateMatchInfo.of({ count, current }),
  });

  // Move to first match if any
  if (count > 0) {
    cmFindNext(view);
    updateMatchInfoFromQuery(view);
  }
}

/**
 * Navigate to the next match
 */
export function findNext(view: EditorView): void {
  const query = getSearchQuery(view.state);
  if (!query.valid) return;

  cmFindNext(view);
  updateMatchInfoFromQuery(view);
}

/**
 * Navigate to the previous match
 */
export function findPrevious(view: EditorView): void {
  const query = getSearchQuery(view.state);
  if (!query.valid) return;

  cmFindPrevious(view);
  updateMatchInfoFromQuery(view);
}

/**
 * Replace the current match
 */
export function replaceOne(view: EditorView): void {
  const query = getSearchQuery(view.state);
  if (!query.valid) return;

  cmReplaceNext(view);
  updateMatchInfoFromQuery(view);
}

/**
 * Replace all matches
 */
export function replaceAll(view: EditorView): void {
  const query = getSearchQuery(view.state);
  if (!query.valid) return;

  cmReplaceAll(view);

  // Clear match info since all matches are replaced
  view.dispatch({
    effects: updateMatchInfo.of({ count: 0, current: 0 }),
  });
}

/**
 * Clear the search
 */
export function clearSearch(view: EditorView): void {
  // Set empty query
  const query = new SearchQuery({ search: "" });
  view.dispatch({
    effects: [
      cmSetSearchQuery.of(query),
      updateMatchInfo.of({ count: 0, current: 0 }),
    ],
  });
}

/**
 * Get the current search state
 */
export function getSearchState(view: EditorView): SearchState {
  const query = getSearchQuery(view.state);
  const matchInfo = view.state.field(matchInfoField);

  return {
    search: query.search ?? "",
    replace: query.replace ?? "",
    caseSensitive: query.caseSensitive ?? false,
    regexp: query.regexp ?? false,
    matchCount: matchInfo.count,
    currentMatch: matchInfo.current,
  };
}

/**
 * Scroll to a specific match index (1-indexed)
 */
export function scrollToMatch(view: EditorView, index: number): void {
  const query = getSearchQuery(view.state);
  if (!query.valid) return;

  const count = countMatches(view, query);
  if (index < 1 || index > count) return;

  // Reset to start
  const doc = view.state.doc;
  let cursor = query.getCursor(doc);
  let match = cursor.next();
  let currentIndex = 0;

  while (!match.done) {
    currentIndex++;
    if (currentIndex === index) {
      view.dispatch({
        selection: { anchor: match.value.from, head: match.value.to },
        scrollIntoView: true,
      });
      updateMatchInfoFromQuery(view);
      return;
    }
    match = cursor.next();
  }
}
