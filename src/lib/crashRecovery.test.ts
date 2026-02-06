import { describe, it, expect, beforeEach } from "vitest";
import {
  storeCrashRecoveryForFile,
  clearCrashRecoveryForFile,
  clearAllCrashRecovery,
  readCrashRecoveryData,
} from "./crashRecovery";

describe("crashRecovery", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("storeCrashRecoveryForFile", () => {
    it("stores data for a single file", () => {
      storeCrashRecoveryForFile("/test/a.md", "content A");

      const data = readCrashRecoveryData();
      expect(data["/test/a.md"]).toBeDefined();
      expect(data["/test/a.md"].content).toBe("content A");
      expect(data["/test/a.md"].timestamp).toBeGreaterThan(0);
    });

    it("stores data for multiple files independently", () => {
      storeCrashRecoveryForFile("/test/a.md", "A");
      storeCrashRecoveryForFile("/test/b.md", "B");

      const data = readCrashRecoveryData();
      expect(Object.keys(data)).toHaveLength(2);
      expect(data["/test/a.md"].content).toBe("A");
      expect(data["/test/b.md"].content).toBe("B");
    });

    it("overwrites data for the same file", () => {
      storeCrashRecoveryForFile("/test/a.md", "old");
      storeCrashRecoveryForFile("/test/a.md", "new");

      const data = readCrashRecoveryData();
      expect(data["/test/a.md"].content).toBe("new");
    });
  });

  describe("clearCrashRecoveryForFile", () => {
    it("removes only the specified file entry", () => {
      storeCrashRecoveryForFile("/test/a.md", "A");
      storeCrashRecoveryForFile("/test/b.md", "B");

      clearCrashRecoveryForFile("/test/a.md");

      const data = readCrashRecoveryData();
      expect(data["/test/a.md"]).toBeUndefined();
      expect(data["/test/b.md"]).toBeDefined();
    });

    it("removes the v2 key entirely when last entry is cleared", () => {
      storeCrashRecoveryForFile("/test/a.md", "A");
      clearCrashRecoveryForFile("/test/a.md");

      expect(localStorage.getItem("jot_crash_recovery_v2")).toBeNull();
    });

    it("handles clearing a non-existent file gracefully", () => {
      storeCrashRecoveryForFile("/test/a.md", "A");
      clearCrashRecoveryForFile("/test/nonexistent.md");

      const data = readCrashRecoveryData();
      expect(data["/test/a.md"].content).toBe("A");
    });
  });

  describe("readCrashRecoveryData", () => {
    it("returns empty object when no data exists", () => {
      const data = readCrashRecoveryData();
      expect(data).toEqual({});
    });

    it("returns valid v2 data", () => {
      const v2Data = {
        "/test/a.md": { content: "A", timestamp: Date.now() },
        "/test/b.md": { content: "B", timestamp: Date.now() },
      };
      localStorage.setItem("jot_crash_recovery_v2", JSON.stringify(v2Data));

      const data = readCrashRecoveryData();
      expect(Object.keys(data)).toHaveLength(2);
      expect(data["/test/a.md"].content).toBe("A");
    });

    it("prunes entries older than 24 hours", () => {
      const old = Date.now() - 25 * 60 * 60 * 1000;
      const recent = Date.now();
      const v2Data = {
        "/test/old.md": { content: "old", timestamp: old },
        "/test/new.md": { content: "new", timestamp: recent },
      };
      localStorage.setItem("jot_crash_recovery_v2", JSON.stringify(v2Data));

      const data = readCrashRecoveryData();
      expect(data["/test/old.md"]).toBeUndefined();
      expect(data["/test/new.md"]).toBeDefined();
    });

    it("handles invalid JSON gracefully", () => {
      localStorage.setItem("jot_crash_recovery_v2", "not valid json");

      const data = readCrashRecoveryData();
      expect(data).toEqual({});
      // Both keys should be cleared
      expect(localStorage.getItem("jot_crash_recovery_v2")).toBeNull();
    });
  });

  describe("v1 migration", () => {
    it("converts single-entry v1 to v2 map", () => {
      const v1Data = {
        filePath: "/test/file.md",
        content: "v1 content",
        timestamp: Date.now(),
      };
      localStorage.setItem("jot_crash_recovery", JSON.stringify(v1Data));

      const data = readCrashRecoveryData();
      expect(data["/test/file.md"]).toBeDefined();
      expect(data["/test/file.md"].content).toBe("v1 content");
    });

    it("deletes v1 key after migration", () => {
      const v1Data = {
        filePath: "/test/file.md",
        content: "v1 content",
        timestamp: Date.now(),
      };
      localStorage.setItem("jot_crash_recovery", JSON.stringify(v1Data));

      readCrashRecoveryData();

      expect(localStorage.getItem("jot_crash_recovery")).toBeNull();
      expect(localStorage.getItem("jot_crash_recovery_v2")).not.toBeNull();
    });

    it("handles null filePath in v1 data", () => {
      const v1Data = {
        filePath: null,
        content: "untitled content",
        timestamp: Date.now(),
      };
      localStorage.setItem("jot_crash_recovery", JSON.stringify(v1Data));

      const data = readCrashRecoveryData();
      // null filePath entries are skipped
      expect(Object.keys(data)).toHaveLength(0);
      // v1 key should still be cleaned up
      expect(localStorage.getItem("jot_crash_recovery")).toBeNull();
    });

    it("prefers v2 over v1 when both exist", () => {
      const v1Data = {
        filePath: "/test/v1.md",
        content: "v1 content",
        timestamp: Date.now(),
      };
      const v2Data = {
        "/test/v2.md": { content: "v2 content", timestamp: Date.now() },
      };
      localStorage.setItem("jot_crash_recovery", JSON.stringify(v1Data));
      localStorage.setItem("jot_crash_recovery_v2", JSON.stringify(v2Data));

      const data = readCrashRecoveryData();
      // Should use v2, not v1
      expect(data["/test/v2.md"]).toBeDefined();
      expect(data["/test/v1.md"]).toBeUndefined();
    });
  });

  describe("clearAllCrashRecovery", () => {
    it("removes both v1 and v2 keys", () => {
      localStorage.setItem("jot_crash_recovery", "v1");
      localStorage.setItem("jot_crash_recovery_v2", "v2");

      clearAllCrashRecovery();

      expect(localStorage.getItem("jot_crash_recovery")).toBeNull();
      expect(localStorage.getItem("jot_crash_recovery_v2")).toBeNull();
    });
  });
});
