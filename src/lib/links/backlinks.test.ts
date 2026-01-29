/**
 * Backlinks index tests
 */

import { describe, it, expect } from "vitest";
import {
  buildBacklinksIndex,
  getBacklinksForFile,
  countTotalBacklinks,
  getMostLinkedFiles,
  type FileContent,
} from "./backlinks";

describe("buildBacklinksIndex", () => {
  const workspacePath = "/workspace";

  it("builds index from files with wiki-style links", () => {
    const files: FileContent[] = [
      {
        path: "/workspace/note-a.md",
        name: "note-a.md",
        content: "This links to [[note-b]].",
      },
      {
        path: "/workspace/note-b.md",
        name: "note-b.md",
        content: "This links to [[note-a]].",
      },
    ];

    const index = buildBacklinksIndex(files, workspacePath);

    expect(index["/workspace/note-b.md"]).toHaveLength(1);
    expect(index["/workspace/note-b.md"][0].sourcePath).toBe("/workspace/note-a.md");
    expect(index["/workspace/note-a.md"]).toHaveLength(1);
    expect(index["/workspace/note-a.md"][0].sourcePath).toBe("/workspace/note-b.md");
  });

  it("builds index from files with markdown-style links", () => {
    const files: FileContent[] = [
      {
        path: "/workspace/doc.md",
        name: "doc.md",
        content: "See [the guide](guide.md) for details.",
      },
    ];

    const index = buildBacklinksIndex(files, workspacePath);

    expect(index["/workspace/guide.md"]).toHaveLength(1);
    expect(index["/workspace/guide.md"][0].sourceName).toBe("doc");
    expect(index["/workspace/guide.md"][0].linkText).toBe("the guide");
  });

  it("handles multiple links to same file", () => {
    const files: FileContent[] = [
      {
        path: "/workspace/a.md",
        name: "a.md",
        content: "Link [[target]] and again [[target|another link]].",
      },
      {
        path: "/workspace/b.md",
        name: "b.md",
        content: "Also links to [[target]].",
      },
    ];

    const index = buildBacklinksIndex(files, workspacePath);

    expect(index["/workspace/target.md"]).toHaveLength(3);
  });

  it("handles files with no links", () => {
    const files: FileContent[] = [
      {
        path: "/workspace/standalone.md",
        name: "standalone.md",
        content: "No links here, just plain text.",
      },
    ];

    const index = buildBacklinksIndex(files, workspacePath);

    expect(Object.keys(index)).toHaveLength(0);
  });

  it("includes context snippet around link", () => {
    const files: FileContent[] = [
      {
        path: "/workspace/article.md",
        name: "article.md",
        content: "This is some text before the link. See [[reference]] for more info. And text after.",
      },
    ];

    const index = buildBacklinksIndex(files, workspacePath);

    expect(index["/workspace/reference.md"][0].context).toContain("before the link");
    expect(index["/workspace/reference.md"][0].context).toContain("more info");
  });
});

describe("getBacklinksForFile", () => {
  it("returns backlinks for existing file", () => {
    const index = {
      "/workspace/target.md": [
        { sourcePath: "/workspace/a.md", sourceName: "a", linkText: "target" },
      ],
    };

    const backlinks = getBacklinksForFile(index, "/workspace/target.md");

    expect(backlinks).toHaveLength(1);
    expect(backlinks[0].sourceName).toBe("a");
  });

  it("returns empty array for file with no backlinks", () => {
    const index = {
      "/workspace/target.md": [
        { sourcePath: "/workspace/a.md", sourceName: "a", linkText: "target" },
      ],
    };

    const backlinks = getBacklinksForFile(index, "/workspace/other.md");

    expect(backlinks).toHaveLength(0);
  });
});

describe("countTotalBacklinks", () => {
  it("counts all backlinks in index", () => {
    const index = {
      "/workspace/a.md": [
        { sourcePath: "/workspace/b.md", sourceName: "b", linkText: "a" },
        { sourcePath: "/workspace/c.md", sourceName: "c", linkText: "a" },
      ],
      "/workspace/b.md": [
        { sourcePath: "/workspace/a.md", sourceName: "a", linkText: "b" },
      ],
    };

    const count = countTotalBacklinks(index);

    expect(count).toBe(3);
  });

  it("returns 0 for empty index", () => {
    const count = countTotalBacklinks({});

    expect(count).toBe(0);
  });
});

describe("getMostLinkedFiles", () => {
  it("returns files sorted by backlink count", () => {
    const index = {
      "/workspace/popular.md": [
        { sourcePath: "/workspace/a.md", sourceName: "a", linkText: "popular" },
        { sourcePath: "/workspace/b.md", sourceName: "b", linkText: "popular" },
        { sourcePath: "/workspace/c.md", sourceName: "c", linkText: "popular" },
      ],
      "/workspace/medium.md": [
        { sourcePath: "/workspace/a.md", sourceName: "a", linkText: "medium" },
        { sourcePath: "/workspace/b.md", sourceName: "b", linkText: "medium" },
      ],
      "/workspace/rare.md": [
        { sourcePath: "/workspace/a.md", sourceName: "a", linkText: "rare" },
      ],
    };

    const mostLinked = getMostLinkedFiles(index, 3);

    expect(mostLinked[0].path).toBe("/workspace/popular.md");
    expect(mostLinked[0].count).toBe(3);
    expect(mostLinked[1].path).toBe("/workspace/medium.md");
    expect(mostLinked[1].count).toBe(2);
    expect(mostLinked[2].path).toBe("/workspace/rare.md");
    expect(mostLinked[2].count).toBe(1);
  });

  it("respects limit parameter", () => {
    const index = {
      "/workspace/a.md": [{ sourcePath: "/workspace/x.md", sourceName: "x", linkText: "a" }],
      "/workspace/b.md": [{ sourcePath: "/workspace/x.md", sourceName: "x", linkText: "b" }],
      "/workspace/c.md": [{ sourcePath: "/workspace/x.md", sourceName: "x", linkText: "c" }],
    };

    const mostLinked = getMostLinkedFiles(index, 2);

    expect(mostLinked).toHaveLength(2);
  });
});
