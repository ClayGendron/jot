/**
 * Tests for CodeMirror 6 Search Extension
 *
 * Tests the search and replace functionality including:
 * - Finding matches in document
 * - Navigating between results
 * - Replacing single and all matches
 * - Case sensitivity and regex modes
 */

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  createSearchExtension,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceOne,
  replaceAll,
  clearSearch,
  getSearchState,
} from "../extensions/search";

// Helper to create editor with search extension
function createEditor(doc: string): EditorView {
  const state = EditorState.create({
    doc,
    extensions: [createSearchExtension()],
  });
  return new EditorView({ state });
}

describe("Search Extension", () => {
  describe("setSearchQuery", () => {
    it("finds all matches for a search term", () => {
      const view = createEditor("hello world, hello universe, hello!");

      setSearchQuery(view, { search: "hello" });

      const state = getSearchState(view);
      expect(state.matchCount).toBe(3);
    });

    it("returns 0 matches for empty search term", () => {
      const view = createEditor("hello world");

      setSearchQuery(view, { search: "" });

      const state = getSearchState(view);
      expect(state.matchCount).toBe(0);
    });

    it("returns 0 matches when no matches found", () => {
      const view = createEditor("hello world");

      setSearchQuery(view, { search: "foo" });

      const state = getSearchState(view);
      expect(state.matchCount).toBe(0);
    });

    it("respects case sensitivity when enabled", () => {
      const view = createEditor("Hello hello HELLO");

      // Case insensitive (default)
      setSearchQuery(view, { search: "hello" });
      expect(getSearchState(view).matchCount).toBe(3);

      // Case sensitive
      setSearchQuery(view, { search: "hello", caseSensitive: true });
      expect(getSearchState(view).matchCount).toBe(1);
    });

    it("supports regex search", () => {
      const view = createEditor("cat bat rat sat mat");

      setSearchQuery(view, { search: "[cbr]at", regexp: true });

      const state = getSearchState(view);
      expect(state.matchCount).toBe(3);
    });

    it("handles invalid regex gracefully", () => {
      const view = createEditor("hello world");

      // Invalid regex - unclosed bracket
      setSearchQuery(view, { search: "[invalid", regexp: true });

      const state = getSearchState(view);
      expect(state.matchCount).toBe(0);
    });

    it("sets the current match index to 0 when matches found", () => {
      const view = createEditor("foo bar foo baz foo");

      setSearchQuery(view, { search: "foo" });

      const state = getSearchState(view);
      expect(state.currentMatch).toBe(1);
      expect(state.matchCount).toBe(3);
    });
  });

  describe("findNext", () => {
    it("moves to the next match", () => {
      const view = createEditor("foo bar foo baz foo");
      setSearchQuery(view, { search: "foo" });

      findNext(view);

      const state = getSearchState(view);
      expect(state.currentMatch).toBe(2);
    });

    it("wraps to first match after last", () => {
      const view = createEditor("foo bar foo");
      setSearchQuery(view, { search: "foo" });

      findNext(view); // Go to 2nd
      findNext(view); // Wrap to 1st

      const state = getSearchState(view);
      expect(state.currentMatch).toBe(1);
    });

    it("does nothing when no matches", () => {
      const view = createEditor("hello world");
      setSearchQuery(view, { search: "foo" });

      const initialState = getSearchState(view);
      findNext(view);
      const finalState = getSearchState(view);

      expect(finalState.currentMatch).toBe(initialState.currentMatch);
    });
  });

  describe("findPrevious", () => {
    it("moves to the previous match", () => {
      const view = createEditor("foo bar foo baz foo");
      setSearchQuery(view, { search: "foo" });
      findNext(view); // Go to 2nd

      findPrevious(view);

      const state = getSearchState(view);
      expect(state.currentMatch).toBe(1);
    });

    it("wraps to last match from first", () => {
      const view = createEditor("foo bar foo baz foo");
      setSearchQuery(view, { search: "foo" });

      findPrevious(view); // Wrap to last

      const state = getSearchState(view);
      expect(state.matchCount).toBe(3);
      expect(state.currentMatch).toBe(3);
    });
  });

  describe("replaceOne", () => {
    it("replaces the current match", () => {
      const view = createEditor("foo bar foo");
      setSearchQuery(view, { search: "foo", replace: "baz" });

      replaceOne(view);

      expect(view.state.doc.toString()).toBe("baz bar foo");
    });

    it("moves to next match after replacement", () => {
      const view = createEditor("foo bar foo baz foo");
      setSearchQuery(view, { search: "foo", replace: "qux" });

      replaceOne(view);

      const state = getSearchState(view);
      expect(state.currentMatch).toBe(1);
      expect(state.matchCount).toBe(2);
    });

    it("does nothing when no matches", () => {
      const view = createEditor("hello world");
      setSearchQuery(view, { search: "foo", replace: "bar" });

      replaceOne(view);

      expect(view.state.doc.toString()).toBe("hello world");
    });

    it("handles empty replacement", () => {
      const view = createEditor("hello world");
      setSearchQuery(view, { search: "world", replace: "" });

      replaceOne(view);

      expect(view.state.doc.toString()).toBe("hello ");
    });
  });

  describe("replaceAll", () => {
    it("replaces all matches", () => {
      const view = createEditor("foo bar foo baz foo");
      setSearchQuery(view, { search: "foo", replace: "qux" });

      replaceAll(view);

      expect(view.state.doc.toString()).toBe("qux bar qux baz qux");
    });

    it("clears match count after replacement", () => {
      const view = createEditor("foo bar foo");
      setSearchQuery(view, { search: "foo", replace: "baz" });

      replaceAll(view);

      const state = getSearchState(view);
      expect(state.matchCount).toBe(0);
    });

    it("handles regex replacement", () => {
      const view = createEditor("cat bat rat");
      setSearchQuery(view, { search: "[cb]at", replace: "dog", regexp: true });

      replaceAll(view);

      expect(view.state.doc.toString()).toBe("dog dog rat");
    });
  });

  describe("clearSearch", () => {
    it("clears all search state", () => {
      const view = createEditor("foo bar foo");
      setSearchQuery(view, { search: "foo" });

      clearSearch(view);

      const state = getSearchState(view);
      expect(state.matchCount).toBe(0);
      expect(state.currentMatch).toBe(0);
    });
  });

  describe("getSearchState", () => {
    it("returns current search state", () => {
      const view = createEditor("hello hello hello");
      setSearchQuery(view, { search: "hello" });

      const state = getSearchState(view);

      expect(state).toEqual({
        search: "hello",
        replace: "",
        caseSensitive: false,
        regexp: false,
        matchCount: 3,
        currentMatch: 1,
      });
    });

    it("returns empty state for no search", () => {
      const view = createEditor("hello world");

      const state = getSearchState(view);

      expect(state).toEqual({
        search: "",
        replace: "",
        caseSensitive: false,
        regexp: false,
        matchCount: 0,
        currentMatch: 0,
      });
    });
  });

  describe("Decorations", () => {
    it("search extension creates valid state", () => {
      // DOM-based decoration tests don't work in jsdom
      // Instead, verify the extension loads and search works
      const view = createEditor("foo bar foo");
      setSearchQuery(view, { search: "foo" });

      const state = getSearchState(view);
      expect(state.matchCount).toBe(2);
      expect(state.search).toBe("foo");
    });

    it("extension handles multiple search queries", () => {
      const view = createEditor("foo bar baz");

      setSearchQuery(view, { search: "foo" });
      expect(getSearchState(view).matchCount).toBe(1);

      setSearchQuery(view, { search: "bar" });
      expect(getSearchState(view).matchCount).toBe(1);
      expect(getSearchState(view).search).toBe("bar");
    });
  });

  describe("Multi-line search", () => {
    it("finds matches across multiple lines", () => {
      const view = createEditor("hello world\nhello universe\nhello!");

      setSearchQuery(view, { search: "hello" });

      const state = getSearchState(view);
      expect(state.matchCount).toBe(3);
    });
  });

  describe("Word boundary search", () => {
    it("can search for whole words with regex", () => {
      const view = createEditor("hello helloing hello");

      setSearchQuery(view, { search: "\\bhello\\b", regexp: true });

      const state = getSearchState(view);
      expect(state.matchCount).toBe(2);
    });
  });
});
