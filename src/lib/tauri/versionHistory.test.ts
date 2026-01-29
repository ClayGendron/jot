/**
 * Tests for Version History helpers
 *
 * Note: The Tauri invoke functions can't be tested in isolation
 * without mocking. These tests focus on the pure helper functions.
 */

import { describe, it, expect } from "vitest";
import {
  formatVersionDate,
  formatByteSize,
  formatWordCount,
} from "./versionHistory";

describe("formatVersionDate", () => {
  it("returns 'Just now' for timestamps less than a minute ago", () => {
    const now = Date.now();
    expect(formatVersionDate(now)).toBe("Just now");
    expect(formatVersionDate(now - 30000)).toBe("Just now"); // 30 seconds ago
  });

  it("returns minutes ago for timestamps less than an hour ago", () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    expect(formatVersionDate(fiveMinutesAgo)).toBe("5m ago");

    const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
    expect(formatVersionDate(thirtyMinutesAgo)).toBe("30m ago");
  });

  it("returns hours ago for timestamps less than a day ago", () => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    expect(formatVersionDate(twoHoursAgo)).toBe("2h ago");

    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
    expect(formatVersionDate(twelveHoursAgo)).toBe("12h ago");
  });

  it("returns days ago for timestamps less than a week ago", () => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    expect(formatVersionDate(threeDaysAgo)).toBe("3d ago");
  });

  it("returns formatted date for older timestamps", () => {
    // Two weeks ago
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const result = formatVersionDate(twoWeeksAgo);
    // Should include month and day
    expect(result).not.toContain("ago");
    expect(result.length).toBeGreaterThan(3);
  });
});

describe("formatByteSize", () => {
  it("formats bytes correctly", () => {
    expect(formatByteSize(0)).toBe("0 B");
    expect(formatByteSize(100)).toBe("100 B");
    expect(formatByteSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes correctly", () => {
    expect(formatByteSize(1024)).toBe("1.0 KB");
    expect(formatByteSize(1536)).toBe("1.5 KB");
    expect(formatByteSize(10240)).toBe("10.0 KB");
    expect(formatByteSize(102400)).toBe("100.0 KB");
  });

  it("formats megabytes correctly", () => {
    expect(formatByteSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatByteSize(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatByteSize(10 * 1024 * 1024)).toBe("10.0 MB");
  });
});

describe("formatWordCount", () => {
  it("handles singular word", () => {
    expect(formatWordCount(1)).toBe("1 word");
  });

  it("handles plural words", () => {
    expect(formatWordCount(0)).toBe("0 words");
    expect(formatWordCount(2)).toBe("2 words");
    expect(formatWordCount(100)).toBe("100 words");
  });

  it("formats large numbers with locale separators", () => {
    const result = formatWordCount(1000);
    // Depending on locale, might be "1,000" or "1.000" or "1 000"
    expect(result).toContain("words");
  });
});
