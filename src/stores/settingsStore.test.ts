import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { useSettingsStore, selectWorkspaceByPath } from "./settingsStore";

// Mock the Tauri settings module
vi.mock("@/lib/tauri/settings", () => ({
  readGlobalSettings: vi.fn(),
  writeGlobalSettings: vi.fn(),
  directoryExists: vi.fn(),
}));

// Import after mocking
import {
  readGlobalSettings,
  writeGlobalSettings,
  directoryExists,
} from "@/lib/tauri/settings";

describe("settingsStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useSettingsStore.setState({
      recentWorkspaces: [],
      defaultWorkspacePath: null,
      isLoaded: false,
      isLoading: false,
      error: null,
    });

    // Reset mocks
    vi.clearAllMocks();
    (writeGlobalSettings as Mock).mockResolvedValue(undefined);
    (directoryExists as Mock).mockResolvedValue(true);
  });

  describe("Initial State", () => {
    it("initializes with empty state", () => {
      const state = useSettingsStore.getState();

      expect(state.recentWorkspaces).toEqual([]);
      expect(state.defaultWorkspacePath).toBeNull();
      expect(state.isLoaded).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("loadSettings", () => {
    it("loads settings from disk", async () => {
      const mockSettings = {
        recentWorkspaces: [
          { path: "/workspace1", name: "workspace1", lastOpened: 1000 },
        ],
        defaultWorkspacePath: "/workspace1",
        version: 1,
      };
      (readGlobalSettings as Mock).mockResolvedValue(mockSettings);

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.recentWorkspaces).toHaveLength(1);
      expect(state.recentWorkspaces[0].path).toBe("/workspace1");
      expect(state.defaultWorkspacePath).toBe("/workspace1");
      expect(state.isLoaded).toBe(true);
      expect(state.isLoading).toBe(false);
    });

    it("uses defaults when no settings file exists", async () => {
      (readGlobalSettings as Mock).mockResolvedValue(null);

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.recentWorkspaces).toEqual([]);
      expect(state.defaultWorkspacePath).toBeNull();
      expect(state.isLoaded).toBe(true);
    });

    it("handles errors gracefully", async () => {
      (readGlobalSettings as Mock).mockRejectedValue(new Error("Read failed"));

      await useSettingsStore.getState().loadSettings();

      const state = useSettingsStore.getState();
      expect(state.error).toBe("Read failed");
      expect(state.isLoaded).toBe(true);
      expect(state.isLoading).toBe(false);
    });
  });

  describe("addRecentWorkspace", () => {
    it("adds new workspace to front of list", async () => {
      await useSettingsStore.getState().addRecentWorkspace("/new/path", "path");

      const state = useSettingsStore.getState();
      expect(state.recentWorkspaces).toHaveLength(1);
      expect(state.recentWorkspaces[0].path).toBe("/new/path");
      expect(state.recentWorkspaces[0].name).toBe("path");
      expect(state.recentWorkspaces[0].lastOpened).toBeGreaterThan(0);
    });

    it("moves existing workspace to front when re-opened", async () => {
      // Add two workspaces
      await useSettingsStore.getState().addRecentWorkspace("/first", "first");
      await useSettingsStore.getState().addRecentWorkspace("/second", "second");

      // Re-open first workspace
      await useSettingsStore.getState().addRecentWorkspace("/first", "first");

      const state = useSettingsStore.getState();
      expect(state.recentWorkspaces).toHaveLength(2);
      expect(state.recentWorkspaces[0].path).toBe("/first");
      expect(state.recentWorkspaces[1].path).toBe("/second");
    });

    it("limits list to 10 entries", async () => {
      // Add 12 workspaces
      for (let i = 0; i < 12; i++) {
        await useSettingsStore
          .getState()
          .addRecentWorkspace(`/workspace${i}`, `workspace${i}`);
      }

      const state = useSettingsStore.getState();
      expect(state.recentWorkspaces).toHaveLength(10);
      // Most recent should be at front
      expect(state.recentWorkspaces[0].path).toBe("/workspace11");
    });

    it("persists to disk after adding", async () => {
      await useSettingsStore.getState().addRecentWorkspace("/new/path", "path");

      expect(writeGlobalSettings).toHaveBeenCalledTimes(1);
      expect(writeGlobalSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          recentWorkspaces: expect.arrayContaining([
            expect.objectContaining({ path: "/new/path" }),
          ]),
        })
      );
    });
  });

  describe("removeRecentWorkspace", () => {
    it("removes workspace from list", async () => {
      await useSettingsStore.getState().addRecentWorkspace("/first", "first");
      await useSettingsStore.getState().addRecentWorkspace("/second", "second");

      await useSettingsStore.getState().removeRecentWorkspace("/first");

      const state = useSettingsStore.getState();
      expect(state.recentWorkspaces).toHaveLength(1);
      expect(state.recentWorkspaces[0].path).toBe("/second");
    });

    it("clears default if it was the removed workspace", async () => {
      await useSettingsStore.getState().addRecentWorkspace("/default", "default");
      await useSettingsStore.getState().setDefaultWorkspace("/default");

      await useSettingsStore.getState().removeRecentWorkspace("/default");

      const state = useSettingsStore.getState();
      expect(state.defaultWorkspacePath).toBeNull();
    });

    it("keeps default if different workspace was removed", async () => {
      await useSettingsStore.getState().addRecentWorkspace("/default", "default");
      await useSettingsStore.getState().addRecentWorkspace("/other", "other");
      await useSettingsStore.getState().setDefaultWorkspace("/default");

      await useSettingsStore.getState().removeRecentWorkspace("/other");

      const state = useSettingsStore.getState();
      expect(state.defaultWorkspacePath).toBe("/default");
    });
  });

  describe("clearRecentWorkspaces", () => {
    it("clears all workspaces and default", async () => {
      await useSettingsStore.getState().addRecentWorkspace("/first", "first");
      await useSettingsStore.getState().addRecentWorkspace("/second", "second");
      await useSettingsStore.getState().setDefaultWorkspace("/first");

      await useSettingsStore.getState().clearRecentWorkspaces();

      const state = useSettingsStore.getState();
      expect(state.recentWorkspaces).toEqual([]);
      expect(state.defaultWorkspacePath).toBeNull();
    });
  });

  describe("setDefaultWorkspace", () => {
    it("sets default workspace path", async () => {
      await useSettingsStore.getState().setDefaultWorkspace("/my/workspace");

      const state = useSettingsStore.getState();
      expect(state.defaultWorkspacePath).toBe("/my/workspace");
    });

    it("clears default when set to null", async () => {
      await useSettingsStore.getState().setDefaultWorkspace("/my/workspace");
      await useSettingsStore.getState().setDefaultWorkspace(null);

      const state = useSettingsStore.getState();
      expect(state.defaultWorkspacePath).toBeNull();
    });

    it("persists to disk", async () => {
      await useSettingsStore.getState().setDefaultWorkspace("/my/workspace");

      expect(writeGlobalSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultWorkspacePath: "/my/workspace",
        })
      );
    });
  });

  describe("cleanupStaleWorkspaces", () => {
    it("removes workspaces that no longer exist", async () => {
      useSettingsStore.setState({
        recentWorkspaces: [
          { path: "/exists", name: "exists", lastOpened: 1000 },
          { path: "/deleted", name: "deleted", lastOpened: 2000 },
        ],
        isLoaded: true,
      });

      (directoryExists as Mock).mockImplementation((path: string) =>
        Promise.resolve(path === "/exists")
      );

      await useSettingsStore.getState().cleanupStaleWorkspaces();

      const state = useSettingsStore.getState();
      expect(state.recentWorkspaces).toHaveLength(1);
      expect(state.recentWorkspaces[0].path).toBe("/exists");
    });

    it("clears default workspace if it no longer exists", async () => {
      useSettingsStore.setState({
        recentWorkspaces: [],
        defaultWorkspacePath: "/deleted",
        isLoaded: true,
      });

      (directoryExists as Mock).mockResolvedValue(false);

      await useSettingsStore.getState().cleanupStaleWorkspaces();

      const state = useSettingsStore.getState();
      expect(state.defaultWorkspacePath).toBeNull();
    });
  });

  describe("selectWorkspaceByPath", () => {
    it("returns workspace by path", () => {
      const state = {
        recentWorkspaces: [
          { path: "/first", name: "first", lastOpened: 1000 },
          { path: "/second", name: "second", lastOpened: 2000 },
        ],
        defaultWorkspacePath: null,
        isLoaded: true,
        isLoading: false,
        error: null,
      };

      const result = selectWorkspaceByPath(state, "/first");
      expect(result?.path).toBe("/first");
    });

    it("returns undefined if not found", () => {
      const state = {
        recentWorkspaces: [
          { path: "/first", name: "first", lastOpened: 1000 },
        ],
        defaultWorkspacePath: null,
        isLoaded: true,
        isLoading: false,
        error: null,
      };

      const result = selectWorkspaceByPath(state, "/nonexistent");
      expect(result).toBeUndefined();
    });
  });
});
