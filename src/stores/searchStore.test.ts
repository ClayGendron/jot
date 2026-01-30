import { describe, it, expect, beforeEach } from "vitest";
import { useSearchStore } from "./searchStore";
import type { GlobalSearchResult } from "./searchStore";

describe("searchStore", () => {
  beforeEach(() => {
    useSearchStore.getState().reset();
  });

  describe("initial state", () => {
    it("starts with document search closed", () => {
      const state = useSearchStore.getState();
      expect(state.documentSearchOpen).toBe(false);
    });

    it("starts with empty document search term", () => {
      const state = useSearchStore.getState();
      expect(state.documentSearchTerm).toBe("");
    });

    it("starts with empty document replace term", () => {
      const state = useSearchStore.getState();
      expect(state.documentReplaceTerm).toBe("");
    });

    it("starts with case sensitivity off", () => {
      const state = useSearchStore.getState();
      expect(state.documentCaseSensitive).toBe(false);
    });

    it("starts with regex mode off", () => {
      const state = useSearchStore.getState();
      expect(state.documentUseRegex).toBe(false);
    });

    it("starts with zero match counts", () => {
      const state = useSearchStore.getState();
      expect(state.documentCurrentMatch).toBe(0);
      expect(state.documentTotalMatches).toBe(0);
    });

    it("starts with global search closed", () => {
      const state = useSearchStore.getState();
      expect(state.globalSearchOpen).toBe(false);
    });

    it("starts with empty global search term", () => {
      const state = useSearchStore.getState();
      expect(state.globalSearchTerm).toBe("");
    });

    it("starts with empty global results", () => {
      const state = useSearchStore.getState();
      expect(state.globalResults).toEqual([]);
    });

    it("starts with global search not searching", () => {
      const state = useSearchStore.getState();
      expect(state.globalIsSearching).toBe(false);
    });

    it("starts with empty path filter", () => {
      const state = useSearchStore.getState();
      expect(state.globalPathFilter).toBe("");
    });
  });

  describe("document search actions", () => {
    it("openDocumentSearch opens the search bar", () => {
      const { openDocumentSearch } = useSearchStore.getState();

      openDocumentSearch();

      expect(useSearchStore.getState().documentSearchOpen).toBe(true);
    });

    it("closeDocumentSearch closes the search bar and clears state", () => {
      const { openDocumentSearch, setDocumentSearchTerm, closeDocumentSearch } =
        useSearchStore.getState();

      openDocumentSearch();
      setDocumentSearchTerm("test");
      closeDocumentSearch();

      const state = useSearchStore.getState();
      expect(state.documentSearchOpen).toBe(false);
      expect(state.documentSearchTerm).toBe("");
      expect(state.documentReplaceTerm).toBe("");
      expect(state.documentCurrentMatch).toBe(0);
      expect(state.documentTotalMatches).toBe(0);
    });

    it("setDocumentSearchTerm updates the search term", () => {
      const { setDocumentSearchTerm } = useSearchStore.getState();

      setDocumentSearchTerm("hello");

      expect(useSearchStore.getState().documentSearchTerm).toBe("hello");
    });

    it("setDocumentReplaceTerm updates the replace term", () => {
      const { setDocumentReplaceTerm } = useSearchStore.getState();

      setDocumentReplaceTerm("world");

      expect(useSearchStore.getState().documentReplaceTerm).toBe("world");
    });

    it("toggleDocumentCaseSensitive toggles case sensitivity", () => {
      const { toggleDocumentCaseSensitive } = useSearchStore.getState();

      expect(useSearchStore.getState().documentCaseSensitive).toBe(false);

      toggleDocumentCaseSensitive();
      expect(useSearchStore.getState().documentCaseSensitive).toBe(true);

      toggleDocumentCaseSensitive();
      expect(useSearchStore.getState().documentCaseSensitive).toBe(false);
    });

    it("toggleDocumentUseRegex toggles regex mode", () => {
      const { toggleDocumentUseRegex } = useSearchStore.getState();

      expect(useSearchStore.getState().documentUseRegex).toBe(false);

      toggleDocumentUseRegex();
      expect(useSearchStore.getState().documentUseRegex).toBe(true);

      toggleDocumentUseRegex();
      expect(useSearchStore.getState().documentUseRegex).toBe(false);
    });

    it("setDocumentMatchInfo updates match counts", () => {
      const { setDocumentMatchInfo } = useSearchStore.getState();

      setDocumentMatchInfo(3, 10);

      const state = useSearchStore.getState();
      expect(state.documentCurrentMatch).toBe(3);
      expect(state.documentTotalMatches).toBe(10);
    });

    it("setDocumentMatchInfo handles zero matches", () => {
      const { setDocumentMatchInfo } = useSearchStore.getState();

      setDocumentMatchInfo(0, 0);

      const state = useSearchStore.getState();
      expect(state.documentCurrentMatch).toBe(0);
      expect(state.documentTotalMatches).toBe(0);
    });
  });

  describe("global search actions", () => {
    it("openGlobalSearch opens the search panel", () => {
      const { openGlobalSearch } = useSearchStore.getState();

      openGlobalSearch();

      expect(useSearchStore.getState().globalSearchOpen).toBe(true);
    });

    it("closeGlobalSearch closes the search panel and clears state", () => {
      const { openGlobalSearch, setGlobalSearchTerm, closeGlobalSearch } =
        useSearchStore.getState();

      openGlobalSearch();
      setGlobalSearchTerm("test");
      closeGlobalSearch();

      const state = useSearchStore.getState();
      expect(state.globalSearchOpen).toBe(false);
      expect(state.globalSearchTerm).toBe("");
      expect(state.globalResults).toEqual([]);
      expect(state.globalPathFilter).toBe("");
    });

    it("setGlobalSearchTerm updates the search term", () => {
      const { setGlobalSearchTerm } = useSearchStore.getState();

      setGlobalSearchTerm("function");

      expect(useSearchStore.getState().globalSearchTerm).toBe("function");
    });

    it("toggleGlobalCaseSensitive toggles case sensitivity", () => {
      const { toggleGlobalCaseSensitive } = useSearchStore.getState();

      expect(useSearchStore.getState().globalCaseSensitive).toBe(false);

      toggleGlobalCaseSensitive();
      expect(useSearchStore.getState().globalCaseSensitive).toBe(true);

      toggleGlobalCaseSensitive();
      expect(useSearchStore.getState().globalCaseSensitive).toBe(false);
    });

    it("toggleGlobalUseRegex toggles regex mode", () => {
      const { toggleGlobalUseRegex } = useSearchStore.getState();

      expect(useSearchStore.getState().globalUseRegex).toBe(false);

      toggleGlobalUseRegex();
      expect(useSearchStore.getState().globalUseRegex).toBe(true);

      toggleGlobalUseRegex();
      expect(useSearchStore.getState().globalUseRegex).toBe(false);
    });

    it("setGlobalPathFilter updates the path filter", () => {
      const { setGlobalPathFilter } = useSearchStore.getState();

      setGlobalPathFilter("docs/*.md");

      expect(useSearchStore.getState().globalPathFilter).toBe("docs/*.md");
    });

    it("setGlobalResults updates results and clears searching state", () => {
      const { setGlobalIsSearching, setGlobalResults } = useSearchStore.getState();

      const mockResults: GlobalSearchResult[] = [
        {
          filePath: "/workspace/notes.md",
          fileName: "notes.md",
          matches: [
            {
              lineNumber: 5,
              lineContent: "This is a test line",
              matchStart: 10,
              matchEnd: 14,
              contextBefore: "Previous line",
              contextAfter: "Next line",
            },
          ],
        },
      ];

      setGlobalIsSearching(true);
      setGlobalResults(mockResults);

      const state = useSearchStore.getState();
      expect(state.globalResults).toEqual(mockResults);
      expect(state.globalIsSearching).toBe(false);
    });

    it("setGlobalIsSearching updates searching state", () => {
      const { setGlobalIsSearching } = useSearchStore.getState();

      setGlobalIsSearching(true);
      expect(useSearchStore.getState().globalIsSearching).toBe(true);

      setGlobalIsSearching(false);
      expect(useSearchStore.getState().globalIsSearching).toBe(false);
    });

    it("clearGlobalResults clears results without closing panel", () => {
      const { openGlobalSearch, setGlobalSearchTerm, setGlobalResults, clearGlobalResults } =
        useSearchStore.getState();

      const mockResults: GlobalSearchResult[] = [
        {
          filePath: "/workspace/notes.md",
          fileName: "notes.md",
          matches: [
            {
              lineNumber: 5,
              lineContent: "This is a test line",
              matchStart: 10,
              matchEnd: 14,
              contextBefore: null,
              contextAfter: null,
            },
          ],
        },
      ];

      openGlobalSearch();
      setGlobalSearchTerm("test");
      setGlobalResults(mockResults);
      clearGlobalResults();

      const state = useSearchStore.getState();
      expect(state.globalSearchOpen).toBe(true);
      expect(state.globalSearchTerm).toBe("test");
      expect(state.globalResults).toEqual([]);
    });
  });

  describe("global search computed values", () => {
    it("calculates total match count correctly", () => {
      const { setGlobalResults } = useSearchStore.getState();

      const mockResults: GlobalSearchResult[] = [
        {
          filePath: "/workspace/notes.md",
          fileName: "notes.md",
          matches: [
            { lineNumber: 1, lineContent: "a", matchStart: 0, matchEnd: 1, contextBefore: null, contextAfter: null },
            { lineNumber: 2, lineContent: "b", matchStart: 0, matchEnd: 1, contextBefore: null, contextAfter: null },
          ],
        },
        {
          filePath: "/workspace/docs/readme.md",
          fileName: "readme.md",
          matches: [
            { lineNumber: 5, lineContent: "c", matchStart: 0, matchEnd: 1, contextBefore: null, contextAfter: null },
          ],
        },
      ];

      setGlobalResults(mockResults);

      const state = useSearchStore.getState();
      // Total matches = 2 + 1 = 3
      const totalMatches = state.globalResults.reduce((acc, r) => acc + r.matches.length, 0);
      expect(totalMatches).toBe(3);
    });
  });

  describe("mutual exclusivity", () => {
    it("opening global search closes document search", () => {
      const { openDocumentSearch, openGlobalSearch } = useSearchStore.getState();

      openDocumentSearch();
      expect(useSearchStore.getState().documentSearchOpen).toBe(true);

      openGlobalSearch();

      const state = useSearchStore.getState();
      expect(state.documentSearchOpen).toBe(false);
      expect(state.globalSearchOpen).toBe(true);
    });

    it("opening document search closes global search", () => {
      const { openDocumentSearch, openGlobalSearch } = useSearchStore.getState();

      openGlobalSearch();
      expect(useSearchStore.getState().globalSearchOpen).toBe(true);

      openDocumentSearch();

      const state = useSearchStore.getState();
      expect(state.globalSearchOpen).toBe(false);
      expect(state.documentSearchOpen).toBe(true);
    });
  });

  describe("reset", () => {
    it("reset returns store to initial state", () => {
      const {
        openDocumentSearch,
        setDocumentSearchTerm,
        openGlobalSearch,
        setGlobalSearchTerm,
        reset,
      } = useSearchStore.getState();

      openDocumentSearch();
      setDocumentSearchTerm("test");
      openGlobalSearch();
      setGlobalSearchTerm("function");

      reset();

      const state = useSearchStore.getState();
      expect(state.documentSearchOpen).toBe(false);
      expect(state.documentSearchTerm).toBe("");
      expect(state.globalSearchOpen).toBe(false);
      expect(state.globalSearchTerm).toBe("");
      expect(state.globalResults).toEqual([]);
    });
  });

  describe("request lifecycle", () => {
    it("starts with null request IDs", () => {
      const state = useSearchStore.getState();
      expect(state.activeDocumentRequestId).toBeNull();
      expect(state.activeGlobalRequestId).toBeNull();
    });

    it("setActiveDocumentRequest updates document request ID", () => {
      const { setActiveDocumentRequest } = useSearchStore.getState();
      const requestId = "doc-123";

      setActiveDocumentRequest(requestId);

      expect(useSearchStore.getState().activeDocumentRequestId).toBe(requestId);
    });

    it("setActiveGlobalRequest updates global request ID", () => {
      const { setActiveGlobalRequest } = useSearchStore.getState();
      const requestId = "global-456";

      setActiveGlobalRequest(requestId);

      expect(useSearchStore.getState().activeGlobalRequestId).toBe(requestId);
    });

    it("isCurrentRequest returns true for matching document request", () => {
      const { setActiveDocumentRequest, isCurrentRequest } = useSearchStore.getState();
      const requestId = "doc-789";

      setActiveDocumentRequest(requestId);

      expect(isCurrentRequest("document", requestId)).toBe(true);
    });

    it("isCurrentRequest returns false for non-matching document request", () => {
      const { setActiveDocumentRequest, isCurrentRequest } = useSearchStore.getState();

      setActiveDocumentRequest("doc-111");

      expect(isCurrentRequest("document", "doc-222")).toBe(false);
    });

    it("isCurrentRequest returns true for matching global request", () => {
      const { setActiveGlobalRequest, isCurrentRequest } = useSearchStore.getState();
      const requestId = "global-999";

      setActiveGlobalRequest(requestId);

      expect(isCurrentRequest("global", requestId)).toBe(true);
    });

    it("isCurrentRequest returns false for non-matching global request", () => {
      const { setActiveGlobalRequest, isCurrentRequest } = useSearchStore.getState();

      setActiveGlobalRequest("global-aaa");

      expect(isCurrentRequest("global", "global-bbb")).toBe(false);
    });

    it("clearing request ID sets it to null", () => {
      const { setActiveDocumentRequest, setActiveGlobalRequest } = useSearchStore.getState();

      setActiveDocumentRequest("doc-123");
      setActiveGlobalRequest("global-456");

      setActiveDocumentRequest(null);
      setActiveGlobalRequest(null);

      const state = useSearchStore.getState();
      expect(state.activeDocumentRequestId).toBeNull();
      expect(state.activeGlobalRequestId).toBeNull();
    });

    it("reset clears request IDs", () => {
      const { setActiveDocumentRequest, setActiveGlobalRequest, reset } =
        useSearchStore.getState();

      setActiveDocumentRequest("doc-123");
      setActiveGlobalRequest("global-456");

      reset();

      const state = useSearchStore.getState();
      expect(state.activeDocumentRequestId).toBeNull();
      expect(state.activeGlobalRequestId).toBeNull();
    });
  });
});
