import { describe, it, expect } from "vitest";
import { sortFileEntries } from "./sortFiles";
import type { FileEntry } from "@/lib/tauri/files";

// Helper to create file entries for testing
function createEntry(
  name: string,
  options: {
    isDir?: boolean;
    modified?: number | null;
    children?: FileEntry[] | null;
  } = {}
): FileEntry {
  const { isDir = false, modified = Date.now(), children = null } = options;
  return {
    name,
    path: `/test/${name}`,
    is_dir: isDir,
    is_markdown: !isDir && name.endsWith(".md"),
    modified,
    children,
  };
}

describe("sortFileEntries", () => {
  describe("sort by name", () => {
    it("sorts files alphabetically ascending (A-Z)", () => {
      const entries: FileEntry[] = [
        createEntry("zebra.md"),
        createEntry("apple.md"),
        createEntry("mango.md"),
      ];

      const sorted = sortFileEntries(entries, "name", "asc");

      expect(sorted.map((e) => e.name)).toEqual([
        "apple.md",
        "mango.md",
        "zebra.md",
      ]);
    });

    it("sorts files alphabetically descending (Z-A)", () => {
      const entries: FileEntry[] = [
        createEntry("apple.md"),
        createEntry("zebra.md"),
        createEntry("mango.md"),
      ];

      const sorted = sortFileEntries(entries, "name", "desc");

      expect(sorted.map((e) => e.name)).toEqual([
        "zebra.md",
        "mango.md",
        "apple.md",
      ]);
    });

    it("performs case-insensitive sorting", () => {
      const entries: FileEntry[] = [
        createEntry("Zebra.md"),
        createEntry("apple.md"),
        createEntry("MANGO.md"),
      ];

      const sorted = sortFileEntries(entries, "name", "asc");

      expect(sorted.map((e) => e.name)).toEqual([
        "apple.md",
        "MANGO.md",
        "Zebra.md",
      ]);
    });
  });

  describe("sort by modified date", () => {
    it("sorts files by date ascending (oldest first)", () => {
      const entries: FileEntry[] = [
        createEntry("new.md", { modified: 3000 }),
        createEntry("old.md", { modified: 1000 }),
        createEntry("mid.md", { modified: 2000 }),
      ];

      const sorted = sortFileEntries(entries, "modified", "asc");

      expect(sorted.map((e) => e.name)).toEqual(["old.md", "mid.md", "new.md"]);
    });

    it("sorts files by date descending (newest first)", () => {
      const entries: FileEntry[] = [
        createEntry("old.md", { modified: 1000 }),
        createEntry("new.md", { modified: 3000 }),
        createEntry("mid.md", { modified: 2000 }),
      ];

      const sorted = sortFileEntries(entries, "modified", "desc");

      expect(sorted.map((e) => e.name)).toEqual(["new.md", "mid.md", "old.md"]);
    });

    it("treats null modified dates as oldest", () => {
      const entries: FileEntry[] = [
        createEntry("has-date.md", { modified: 1000 }),
        createEntry("no-date.md", { modified: null }),
        createEntry("newer.md", { modified: 2000 }),
      ];

      const sorted = sortFileEntries(entries, "modified", "asc");

      expect(sorted.map((e) => e.name)).toEqual([
        "no-date.md",
        "has-date.md",
        "newer.md",
      ]);
    });
  });

  describe("folders always first", () => {
    it("keeps folders before files when sorting by name ascending", () => {
      const entries: FileEntry[] = [
        createEntry("zebra.md"),
        createEntry("docs", { isDir: true, children: [] }),
        createEntry("apple.md"),
        createEntry("archive", { isDir: true, children: [] }),
      ];

      const sorted = sortFileEntries(entries, "name", "asc");

      expect(sorted.map((e) => e.name)).toEqual([
        "archive",
        "docs",
        "apple.md",
        "zebra.md",
      ]);
    });

    it("keeps folders before files when sorting by name descending", () => {
      const entries: FileEntry[] = [
        createEntry("apple.md"),
        createEntry("archive", { isDir: true, children: [] }),
        createEntry("zebra.md"),
        createEntry("docs", { isDir: true, children: [] }),
      ];

      const sorted = sortFileEntries(entries, "name", "desc");

      expect(sorted.map((e) => e.name)).toEqual([
        "docs",
        "archive",
        "zebra.md",
        "apple.md",
      ]);
    });

    it("keeps folders before files when sorting by date", () => {
      const entries: FileEntry[] = [
        createEntry("old-file.md", { modified: 1000 }),
        createEntry("new-folder", { isDir: true, modified: 3000, children: [] }),
        createEntry("new-file.md", { modified: 3000 }),
        createEntry("old-folder", { isDir: true, modified: 1000, children: [] }),
      ];

      const sorted = sortFileEntries(entries, "modified", "desc");

      expect(sorted.map((e) => e.name)).toEqual([
        "new-folder",
        "old-folder",
        "new-file.md",
        "old-file.md",
      ]);
    });
  });

  describe("recursive sorting", () => {
    it("sorts children of folders", () => {
      const entries: FileEntry[] = [
        createEntry("docs", {
          isDir: true,
          children: [
            createEntry("zebra.md"),
            createEntry("apple.md"),
            createEntry("mango.md"),
          ],
        }),
      ];

      const sorted = sortFileEntries(entries, "name", "asc");

      expect(sorted[0].children?.map((e) => e.name)).toEqual([
        "apple.md",
        "mango.md",
        "zebra.md",
      ]);
    });

    it("sorts nested folders and their children", () => {
      const entries: FileEntry[] = [
        createEntry("zebra.md"),
        createEntry("docs", {
          isDir: true,
          children: [
            createEntry("subfolder", {
              isDir: true,
              children: [
                createEntry("zulu.md"),
                createEntry("alpha.md"),
              ],
            }),
            createEntry("intro.md"),
          ],
        }),
        createEntry("apple.md"),
      ];

      const sorted = sortFileEntries(entries, "name", "asc");

      // Root level: folder first, then files
      expect(sorted.map((e) => e.name)).toEqual([
        "docs",
        "apple.md",
        "zebra.md",
      ]);

      // docs children: subfolder first, then intro.md
      expect(sorted[0].children?.map((e) => e.name)).toEqual([
        "subfolder",
        "intro.md",
      ]);

      // subfolder children: sorted alphabetically
      expect(sorted[0].children?.[0].children?.map((e) => e.name)).toEqual([
        "alpha.md",
        "zulu.md",
      ]);
    });
  });

  describe("edge cases", () => {
    it("handles empty array", () => {
      const sorted = sortFileEntries([], "name", "asc");
      expect(sorted).toEqual([]);
    });

    it("handles single entry", () => {
      const entries: FileEntry[] = [createEntry("solo.md")];
      const sorted = sortFileEntries(entries, "name", "asc");
      expect(sorted.map((e) => e.name)).toEqual(["solo.md"]);
    });

    it("handles folder with null children", () => {
      const entries: FileEntry[] = [
        createEntry("empty-folder", { isDir: true, children: null }),
        createEntry("file.md"),
      ];

      const sorted = sortFileEntries(entries, "name", "asc");

      expect(sorted[0].children).toBeNull();
    });

    it("does not mutate original array", () => {
      const original: FileEntry[] = [
        createEntry("zebra.md"),
        createEntry("apple.md"),
      ];
      const originalOrder = original.map((e) => e.name);

      sortFileEntries(original, "name", "asc");

      expect(original.map((e) => e.name)).toEqual(originalOrder);
    });
  });
});
