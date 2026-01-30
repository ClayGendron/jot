/**
 * Links Store Tests
 *
 * Tests for the linksStore, including incremental indexing methods.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useLinksStore } from "./linksStore";

describe("linksStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useLinksStore.setState({
      backlinksIndex: {},
      isIndexing: false,
      lastIndexed: null,
      fileHashes: {},
    });
  });

  describe("setFileHash", () => {
    it("sets hash for a file", () => {
      useLinksStore.getState().setFileHash("/workspace/test.md", "abc123");

      const hashes = useLinksStore.getState().fileHashes;
      expect(hashes["/workspace/test.md"]).toBe("abc123");
    });

    it("updates existing hash", () => {
      useLinksStore.getState().setFileHash("/workspace/test.md", "old");
      useLinksStore.getState().setFileHash("/workspace/test.md", "new");

      const hashes = useLinksStore.getState().fileHashes;
      expect(hashes["/workspace/test.md"]).toBe("new");
    });

    it("preserves other hashes", () => {
      useLinksStore.getState().setFileHash("/workspace/a.md", "hash-a");
      useLinksStore.getState().setFileHash("/workspace/b.md", "hash-b");

      const hashes = useLinksStore.getState().fileHashes;
      expect(hashes["/workspace/a.md"]).toBe("hash-a");
      expect(hashes["/workspace/b.md"]).toBe("hash-b");
    });
  });

  describe("updateFileInIndex", () => {
    const workspacePath = "/workspace";

    it("adds new backlinks from file", () => {
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "Link to [[target]]",
        workspacePath
      );

      const index = useLinksStore.getState().backlinksIndex;
      expect(index["/workspace/target.md"]).toHaveLength(1);
      expect(index["/workspace/target.md"][0].sourcePath).toBe("/workspace/source.md");
    });

    it("removes old backlinks when file updated", () => {
      // First update: links to target-a
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "Link to [[target-a]]",
        workspacePath
      );

      // Second update: now links to target-b instead
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "Link to [[target-b]]",
        workspacePath
      );

      const index = useLinksStore.getState().backlinksIndex;

      // Old link should be removed
      expect(index["/workspace/target-a.md"]).toBeUndefined();

      // New link should exist
      expect(index["/workspace/target-b.md"]).toHaveLength(1);
    });

    it("handles multiple links in file", () => {
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "Links to [[a]], [[b]], and [[c]]",
        workspacePath
      );

      const index = useLinksStore.getState().backlinksIndex;
      expect(index["/workspace/a.md"]).toHaveLength(1);
      expect(index["/workspace/b.md"]).toHaveLength(1);
      expect(index["/workspace/c.md"]).toHaveLength(1);
    });

    it("handles markdown-style links", () => {
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "See [the docs](docs.md) for more",
        workspacePath
      );

      const index = useLinksStore.getState().backlinksIndex;
      expect(index["/workspace/docs.md"]).toHaveLength(1);
      expect(index["/workspace/docs.md"][0].linkText).toBe("the docs");
    });

    it("preserves backlinks from other files", () => {
      // File A links to target
      useLinksStore.getState().updateFileInIndex(
        "/workspace/a.md",
        "[[target]]",
        workspacePath
      );

      // File B links to target
      useLinksStore.getState().updateFileInIndex(
        "/workspace/b.md",
        "[[target]]",
        workspacePath
      );

      // Update file A to link to something else
      useLinksStore.getState().updateFileInIndex(
        "/workspace/a.md",
        "[[other]]",
        workspacePath
      );

      const index = useLinksStore.getState().backlinksIndex;

      // B's link to target should still exist
      expect(index["/workspace/target.md"]).toHaveLength(1);
      expect(index["/workspace/target.md"][0].sourcePath).toBe("/workspace/b.md");
    });

    it("handles file with no links", () => {
      // First add some links
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "[[target]]",
        workspacePath
      );

      // Then update to have no links
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "No links here",
        workspacePath
      );

      const index = useLinksStore.getState().backlinksIndex;
      expect(index["/workspace/target.md"]).toBeUndefined();
    });

    it("includes context around link", () => {
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "Some text before [[target]] and some text after",
        workspacePath
      );

      const index = useLinksStore.getState().backlinksIndex;
      const context = index["/workspace/target.md"][0].context;
      expect(context).toContain("before");
      expect(context).toContain("after");
    });

    it("updates lastIndexed timestamp", () => {
      const before = useLinksStore.getState().lastIndexed;

      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "[[target]]",
        workspacePath
      );

      const after = useLinksStore.getState().lastIndexed;
      expect(after).not.toEqual(before);
      expect(after).toBeInstanceOf(Date);
    });

    it("normalizes ./target relative links", () => {
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "Link to [[./notes/a]]",
        workspacePath
      );

      const index = useLinksStore.getState().backlinksIndex;
      // Should normalize ./notes/a to notes/a
      expect(index["/workspace/notes/a.md"]).toHaveLength(1);
      expect(index["/workspace/./notes/a.md"]).toBeUndefined();
    });

    it("normalizes embedded /./ in paths", () => {
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "Link to [[docs/./readme]]",
        workspacePath
      );

      const index = useLinksStore.getState().backlinksIndex;
      expect(index["/workspace/docs/readme.md"]).toHaveLength(1);
    });

    it("skips ../ relative links (cannot resolve correctly)", () => {
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "Link to [[../other]]",
        workspacePath
      );

      const index = useLinksStore.getState().backlinksIndex;
      // Should not create a backlink for ../ paths
      expect(Object.keys(index)).toHaveLength(0);
    });

    it("handles Windows-style backslashes in paths", () => {
      // Test that sourceName extraction works with backslashes
      // All paths should be normalized to forward slashes for consistency
      useLinksStore.getState().updateFileInIndex(
        "C:\\workspace\\folder\\source.md",
        "Link to [[target]]",
        "C:\\workspace"
      );

      const index = useLinksStore.getState().backlinksIndex;
      // Paths are normalized to forward slashes
      const entries = index["C:/workspace/folder/target.md"];
      expect(entries).toHaveLength(1);
      expect(entries[0].sourceName).toBe("source");
    });

    it("normalizes Windows backslashes in link targets", () => {
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "Link to [[docs\\readme]]",
        workspacePath
      );

      const index = useLinksStore.getState().backlinksIndex;
      // Backslashes should be converted to forward slashes
      expect(index["/workspace/docs/readme.md"]).toHaveLength(1);
    });
  });

  describe("removeFileFromIndex", () => {
    const workspacePath = "/workspace";

    beforeEach(() => {
      // Set up initial state with some backlinks
      useLinksStore.getState().updateFileInIndex(
        "/workspace/a.md",
        "Links to [[b]] and [[c]]",
        workspacePath
      );
      useLinksStore.getState().updateFileInIndex(
        "/workspace/b.md",
        "Links to [[a]]",
        workspacePath
      );
      useLinksStore.getState().setFileHash("/workspace/a.md", "hash-a");
      useLinksStore.getState().setFileHash("/workspace/b.md", "hash-b");
    });

    it("removes backlinks FROM deleted file", () => {
      useLinksStore.getState().removeFileFromIndex("/workspace/a.md");

      const index = useLinksStore.getState().backlinksIndex;

      // a.md's links to b.md and c.md should be gone
      expect(index["/workspace/b.md"]).toBeUndefined();
      expect(index["/workspace/c.md"]).toBeUndefined();
    });

    it("removes backlinks TO deleted file", () => {
      useLinksStore.getState().removeFileFromIndex("/workspace/a.md");

      const index = useLinksStore.getState().backlinksIndex;

      // b.md's link to a.md should be gone
      expect(index["/workspace/a.md"]).toBeUndefined();
    });

    it("removes hash for deleted file", () => {
      useLinksStore.getState().removeFileFromIndex("/workspace/a.md");

      const hashes = useLinksStore.getState().fileHashes;
      expect(hashes["/workspace/a.md"]).toBeUndefined();
    });

    it("preserves unrelated backlinks", () => {
      // Add another file
      useLinksStore.getState().updateFileInIndex(
        "/workspace/c.md",
        "Links to [[d]]",
        workspacePath
      );

      useLinksStore.getState().removeFileFromIndex("/workspace/a.md");

      const index = useLinksStore.getState().backlinksIndex;

      // c.md's link to d.md should still exist
      expect(index["/workspace/d.md"]).toHaveLength(1);
    });

    it("preserves unrelated hashes", () => {
      useLinksStore.getState().removeFileFromIndex("/workspace/a.md");

      const hashes = useLinksStore.getState().fileHashes;
      expect(hashes["/workspace/b.md"]).toBe("hash-b");
    });
  });

  describe("clearIndex", () => {
    it("clears all backlinks", () => {
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "[[target]]",
        "/workspace"
      );

      useLinksStore.getState().clearIndex();

      const state = useLinksStore.getState();
      expect(Object.keys(state.backlinksIndex)).toHaveLength(0);
    });

    it("clears all hashes", () => {
      useLinksStore.getState().setFileHash("/workspace/a.md", "hash");

      useLinksStore.getState().clearIndex();

      const state = useLinksStore.getState();
      expect(Object.keys(state.fileHashes)).toHaveLength(0);
    });

    it("clears lastIndexed", () => {
      useLinksStore.getState().updateFileInIndex(
        "/workspace/source.md",
        "[[target]]",
        "/workspace"
      );

      useLinksStore.getState().clearIndex();

      const state = useLinksStore.getState();
      expect(state.lastIndexed).toBeNull();
    });
  });
});
