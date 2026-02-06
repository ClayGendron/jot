import { describe, it, expect, beforeEach } from "vitest";
import { useWorkspaceStore } from "./workspaceStore";
import type { FileEntry } from "@/lib/tauri/files";

const mockFileTree: FileEntry[] = [
  {
    name: "docs",
    path: "/workspace/docs",
    is_dir: true,
    is_markdown: false,
    modified: 1700000000,
    children: [
      {
        name: "readme.md",
        path: "/workspace/docs/readme.md",
        is_dir: false,
        is_markdown: true,
        modified: 1700000001,
        children: null,
      },
    ],
  },
  {
    name: "notes.md",
    path: "/workspace/notes.md",
    is_dir: false,
    is_markdown: true,
    modified: 1700000002,
    children: null,
  },
];

describe("workspaceStore", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().reset();
  });

  describe("initial state", () => {
    it("starts with null workspace path", () => {
      const state = useWorkspaceStore.getState();
      expect(state.workspacePath).toBeNull();
    });

    it("starts with empty file tree", () => {
      const state = useWorkspaceStore.getState();
      expect(state.fileTree).toEqual([]);
    });

    it("starts with no selected path", () => {
      const state = useWorkspaceStore.getState();
      expect(state.selectedPath).toBeNull();
    });

    it("starts with empty expanded paths", () => {
      const state = useWorkspaceStore.getState();
      expect(state.expandedPaths.size).toBe(0);
    });
  });

  describe("workspace management", () => {
    it("setWorkspacePath updates path and clears state", () => {
      const { setFileTree, setSelectedPath, setWorkspacePath } =
        useWorkspaceStore.getState();

      // Set up some state first
      setFileTree(mockFileTree);
      setSelectedPath("/some/file.md");

      // Set workspace path
      setWorkspacePath("/new/workspace");

      const state = useWorkspaceStore.getState();
      expect(state.workspacePath).toBe("/new/workspace");
      expect(state.fileTree).toEqual([]);
      expect(state.selectedPath).toBeNull();
    });

    it("setFileTree updates file tree", () => {
      const { setFileTree } = useWorkspaceStore.getState();

      setFileTree(mockFileTree);

      const state = useWorkspaceStore.getState();
      expect(state.fileTree).toEqual(mockFileTree);
    });

    it("loadWorkspace atomically sets path and file tree together", () => {
      const { loadWorkspace } = useWorkspaceStore.getState();

      loadWorkspace("/workspace", mockFileTree);

      const state = useWorkspaceStore.getState();
      expect(state.workspacePath).toBe("/workspace");
      expect(state.fileTree).toEqual(mockFileTree);
      expect(state.selectedPath).toBeNull();
      expect(state.expandedPaths.size).toBe(0);
      expect(state.error).toBeNull();
      expect(state.isLoading).toBe(false);
    });

    it("loadWorkspace does not clear fileTree like setWorkspacePath does", () => {
      const { loadWorkspace } = useWorkspaceStore.getState();

      // This is the key test - loadWorkspace sets both atomically
      // so fileTree is NOT cleared after setting workspacePath
      loadWorkspace("/workspace", mockFileTree);

      const state = useWorkspaceStore.getState();
      // fileTree should have the entries, not be empty
      expect(state.fileTree.length).toBeGreaterThan(0);
      expect(state.fileTree).toEqual(mockFileTree);
    });
  });

  describe("selection", () => {
    it("setSelectedPath updates selected path", () => {
      const { setSelectedPath } = useWorkspaceStore.getState();

      setSelectedPath("/workspace/notes.md");

      expect(useWorkspaceStore.getState().selectedPath).toBe(
        "/workspace/notes.md"
      );
    });

    it("setSelectedPath can clear selection", () => {
      const { setSelectedPath } = useWorkspaceStore.getState();

      setSelectedPath("/workspace/notes.md");
      setSelectedPath(null);

      expect(useWorkspaceStore.getState().selectedPath).toBeNull();
    });
  });

  describe("expansion", () => {
    it("toggleExpanded adds path if not expanded", () => {
      const { toggleExpanded } = useWorkspaceStore.getState();

      toggleExpanded("/workspace/docs");

      expect(useWorkspaceStore.getState().expandedPaths.has("/workspace/docs")).toBe(
        true
      );
    });

    it("toggleExpanded removes path if already expanded", () => {
      const { toggleExpanded } = useWorkspaceStore.getState();

      toggleExpanded("/workspace/docs");
      toggleExpanded("/workspace/docs");

      expect(useWorkspaceStore.getState().expandedPaths.has("/workspace/docs")).toBe(
        false
      );
    });

    it("setExpanded explicitly sets expansion state", () => {
      const { setExpanded } = useWorkspaceStore.getState();

      setExpanded("/workspace/docs", true);
      expect(useWorkspaceStore.getState().expandedPaths.has("/workspace/docs")).toBe(
        true
      );

      setExpanded("/workspace/docs", false);
      expect(useWorkspaceStore.getState().expandedPaths.has("/workspace/docs")).toBe(
        false
      );
    });

    it("expandAll expands all directories", () => {
      const { setFileTree, expandAll } = useWorkspaceStore.getState();

      setFileTree(mockFileTree);
      expandAll();

      const state = useWorkspaceStore.getState();
      expect(state.expandedPaths.has("/workspace/docs")).toBe(true);
    });

    it("collapseAll clears all expanded paths", () => {
      const { setFileTree, expandAll, collapseAll } =
        useWorkspaceStore.getState();

      setFileTree(mockFileTree);
      expandAll();
      collapseAll();

      expect(useWorkspaceStore.getState().expandedPaths.size).toBe(0);
    });
  });

  describe("loading and error states", () => {
    it("setLoading updates loading state", () => {
      const { setLoading } = useWorkspaceStore.getState();

      setLoading(true);
      expect(useWorkspaceStore.getState().isLoading).toBe(true);

      setLoading(false);
      expect(useWorkspaceStore.getState().isLoading).toBe(false);
    });

    it("setError updates error state", () => {
      const { setError } = useWorkspaceStore.getState();

      setError("Something went wrong");
      expect(useWorkspaceStore.getState().error).toBe("Something went wrong");

      setError(null);
      expect(useWorkspaceStore.getState().error).toBeNull();
    });
  });

  describe("sorting", () => {
    it("setSortBy updates sort field", () => {
      const { setSortBy } = useWorkspaceStore.getState();

      setSortBy("modified");
      expect(useWorkspaceStore.getState().sortBy).toBe("modified");

      setSortBy("name");
      expect(useWorkspaceStore.getState().sortBy).toBe("name");
    });

    it("setSortDirection updates sort direction", () => {
      const { setSortDirection } = useWorkspaceStore.getState();

      setSortDirection("desc");
      expect(useWorkspaceStore.getState().sortDirection).toBe("desc");

      setSortDirection("asc");
      expect(useWorkspaceStore.getState().sortDirection).toBe("asc");
    });
  });

  describe("file operations", () => {
    beforeEach(() => {
      const { setFileTree, setWorkspacePath } = useWorkspaceStore.getState();
      setWorkspacePath("/workspace");
      setFileTree(mockFileTree);
    });

    it("addEntry adds file to root", () => {
      const { addEntry } = useWorkspaceStore.getState();

      const newFile: FileEntry = {
        name: "new.md",
        path: "/workspace/new.md",
        is_dir: false,
        is_markdown: true,
        modified: 1700000003,
        children: null,
      };

      addEntry("/workspace", newFile);

      const state = useWorkspaceStore.getState();
      expect(state.fileTree.find((f) => f.name === "new.md")).toBeDefined();
    });

    it("addEntry adds file to nested folder", () => {
      const { addEntry } = useWorkspaceStore.getState();

      const newFile: FileEntry = {
        name: "guide.md",
        path: "/workspace/docs/guide.md",
        is_dir: false,
        is_markdown: true,
        modified: 1700000003,
        children: null,
      };

      addEntry("/workspace/docs", newFile);

      const state = useWorkspaceStore.getState();
      const docsFolder = state.fileTree.find((f) => f.name === "docs");
      expect(docsFolder?.children?.find((f) => f.name === "guide.md")).toBeDefined();
    });

    it("removeEntry removes file from tree", () => {
      const { removeEntry } = useWorkspaceStore.getState();

      removeEntry("/workspace/notes.md");

      const state = useWorkspaceStore.getState();
      expect(state.fileTree.find((f) => f.name === "notes.md")).toBeUndefined();
    });

    it("removeEntry removes nested file from tree", () => {
      const { removeEntry } = useWorkspaceStore.getState();

      removeEntry("/workspace/docs/readme.md");

      const state = useWorkspaceStore.getState();
      const docsFolder = state.fileTree.find((f) => f.name === "docs");
      expect(docsFolder?.children?.find((f) => f.name === "readme.md")).toBeUndefined();
    });

    it("updateEntry updates file properties", () => {
      const { updateEntry } = useWorkspaceStore.getState();

      updateEntry("/workspace/notes.md", { modified: 9999999999 });

      const state = useWorkspaceStore.getState();
      const file = state.fileTree.find((f) => f.name === "notes.md");
      expect(file?.modified).toBe(9999999999);
    });
  });

  describe("reset", () => {
    it("reset returns store to initial state", () => {
      const { setFileTree, setSelectedPath, setWorkspacePath, setLoading, reset } =
        useWorkspaceStore.getState();

      setWorkspacePath("/workspace");
      setFileTree(mockFileTree);
      setSelectedPath("/workspace/notes.md");
      setLoading(true);

      reset();

      const state = useWorkspaceStore.getState();
      expect(state.workspacePath).toBeNull();
      expect(state.fileTree).toEqual([]);
      expect(state.selectedPath).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });
});
