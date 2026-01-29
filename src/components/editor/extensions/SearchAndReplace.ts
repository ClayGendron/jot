/**
 * SearchAndReplace TipTap Extension
 *
 * Provides in-document search and replace functionality with:
 * - Highlighted search results via ProseMirror decorations
 * - Case-sensitive and regex search modes
 * - Find next/previous navigation
 * - Single and bulk replace operations
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface SearchAndReplaceOptions {
  searchResultClass: string;
  searchResultCurrentClass: string;
}

export interface SearchAndReplaceStorage {
  searchTerm: string;
  replaceTerm: string;
  results: { from: number; to: number }[];
  resultIndex: number;
  caseSensitive: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchAndReplace: {
      /**
       * Set the search term and find all matches
       */
      setSearchTerm: (
        searchTerm: string,
        caseSensitive?: boolean
      ) => ReturnType;

      /**
       * Set the replacement text
       */
      setReplaceTerm: (replaceTerm: string) => ReturnType;

      /**
       * Toggle case sensitivity
       */
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;

      /**
       * Navigate to the next search result
       */
      nextSearchResult: () => ReturnType;

      /**
       * Navigate to the previous search result
       */
      previousSearchResult: () => ReturnType;

      /**
       * Replace the current match
       */
      replace: () => ReturnType;

      /**
       * Replace all matches
       */
      replaceAll: () => ReturnType;

      /**
       * Clear the search
       */
      clearSearch: () => ReturnType;
    };
  }
}

export const SearchAndReplacePluginKey = new PluginKey("searchAndReplace");

/**
 * Find all text matches in the document
 */
function findMatches(
  doc: ProseMirrorNode,
  searchTerm: string,
  caseSensitive: boolean
): { from: number; to: number }[] {
  if (!searchTerm) return [];

  const results: { from: number; to: number }[] = [];

  // Collect all text nodes with their positions
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const text = node.text;
      const searchText = caseSensitive ? text : text.toLowerCase();
      const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

      let index = 0;
      while ((index = searchText.indexOf(term, index)) !== -1) {
        results.push({
          from: pos + index,
          to: pos + index + searchTerm.length,
        });
        index += 1; // Allow overlapping matches
      }
    }
  });

  return results;
}

/**
 * Create decorations for search results
 */
function createDecorations(
  doc: ProseMirrorNode,
  results: { from: number; to: number }[],
  currentIndex: number,
  resultClass: string,
  currentClass: string
): DecorationSet {
  const decorations = results.map((result, index) => {
    const className =
      index === currentIndex ? `${resultClass} ${currentClass}` : resultClass;

    return Decoration.inline(result.from, result.to, {
      class: className,
    });
  });

  return DecorationSet.create(doc, decorations);
}

export const SearchAndReplace = Extension.create<
  SearchAndReplaceOptions,
  SearchAndReplaceStorage
>({
  name: "searchAndReplace",

  addOptions() {
    return {
      searchResultClass: "search-result",
      searchResultCurrentClass: "search-result-current",
    };
  },

  addStorage() {
    return {
      searchTerm: "",
      replaceTerm: "",
      results: [],
      resultIndex: 0,
      caseSensitive: false,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (searchTerm: string, caseSensitive?: boolean) =>
        ({ editor, tr }) => {
          const storage = this.storage;
          storage.searchTerm = searchTerm;

          if (caseSensitive !== undefined) {
            storage.caseSensitive = caseSensitive;
          }

          // Find all matches
          storage.results = findMatches(
            tr.doc,
            searchTerm,
            storage.caseSensitive
          );
          storage.resultIndex = storage.results.length > 0 ? 0 : -1;

          // Force plugin state update
          editor.view.dispatch(tr);

          // Scroll to first result if found
          if (storage.results.length > 0) {
            const firstResult = storage.results[0];
            editor.commands.setTextSelection(firstResult.from);
            editor.commands.scrollIntoView();
          }

          return true;
        },

      setReplaceTerm:
        (replaceTerm: string) =>
        ({ editor }) => {
          this.storage.replaceTerm = replaceTerm;
          // Force view update
          editor.view.dispatch(editor.state.tr);
          return true;
        },

      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor, tr }) => {
          const storage = this.storage;
          storage.caseSensitive = caseSensitive;

          // Re-run search with new case sensitivity
          storage.results = findMatches(
            tr.doc,
            storage.searchTerm,
            caseSensitive
          );
          storage.resultIndex =
            storage.results.length > 0
              ? Math.min(storage.resultIndex, storage.results.length - 1)
              : -1;

          editor.view.dispatch(tr);
          return true;
        },

      nextSearchResult:
        () =>
        ({ editor, tr }) => {
          const storage = this.storage;
          if (storage.results.length === 0) return false;

          storage.resultIndex =
            (storage.resultIndex + 1) % storage.results.length;

          // Scroll to result
          const result = storage.results[storage.resultIndex];
          editor.commands.setTextSelection(result.from);
          editor.commands.scrollIntoView();

          editor.view.dispatch(tr);
          return true;
        },

      previousSearchResult:
        () =>
        ({ editor, tr }) => {
          const storage = this.storage;
          if (storage.results.length === 0) return false;

          storage.resultIndex =
            storage.resultIndex <= 0
              ? storage.results.length - 1
              : storage.resultIndex - 1;

          // Scroll to result
          const result = storage.results[storage.resultIndex];
          editor.commands.setTextSelection(result.from);
          editor.commands.scrollIntoView();

          editor.view.dispatch(tr);
          return true;
        },

      replace:
        () =>
        ({ editor, tr }) => {
          const storage = this.storage;
          if (
            storage.results.length === 0 ||
            storage.resultIndex < 0 ||
            storage.resultIndex >= storage.results.length
          ) {
            return false;
          }

          const result = storage.results[storage.resultIndex];

          // Replace the current match
          tr.insertText(storage.replaceTerm, result.from, result.to);
          editor.view.dispatch(tr);

          // Re-find matches after replacement
          const newTr = editor.state.tr;
          storage.results = findMatches(
            newTr.doc,
            storage.searchTerm,
            storage.caseSensitive
          );

          // Adjust index if needed
          if (storage.results.length === 0) {
            storage.resultIndex = -1;
          } else if (storage.resultIndex >= storage.results.length) {
            storage.resultIndex = 0;
          }

          // Scroll to next result if available
          if (storage.results.length > 0 && storage.resultIndex >= 0) {
            const nextResult = storage.results[storage.resultIndex];
            editor.commands.setTextSelection(nextResult.from);
            editor.commands.scrollIntoView();
          }

          editor.view.dispatch(newTr);
          return true;
        },

      replaceAll:
        () =>
        ({ editor, tr }) => {
          const storage = this.storage;
          if (storage.results.length === 0) return false;

          // Replace all matches from end to start to preserve positions
          const sortedResults = [...storage.results].sort(
            (a, b) => b.from - a.from
          );

          for (const result of sortedResults) {
            tr.insertText(storage.replaceTerm, result.from, result.to);
          }

          editor.view.dispatch(tr);

          // Clear results after replace all
          storage.results = [];
          storage.resultIndex = -1;

          return true;
        },

      clearSearch:
        () =>
        ({ editor, tr }) => {
          const storage = this.storage;
          storage.searchTerm = "";
          storage.replaceTerm = "";
          storage.results = [];
          storage.resultIndex = -1;

          editor.view.dispatch(tr);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const { searchResultClass, searchResultCurrentClass } = this.options;
    const storage = this.storage;

    return [
      new Plugin({
        key: SearchAndReplacePluginKey,

        state: {
          init() {
            return DecorationSet.empty;
          },

          apply(tr, _oldDecorations) {
            // Recreate decorations based on current storage state
            if (storage.results.length === 0) {
              return DecorationSet.empty;
            }

            return createDecorations(
              tr.doc,
              storage.results,
              storage.resultIndex,
              searchResultClass,
              searchResultCurrentClass
            );
          },
        },

        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

export default SearchAndReplace;
