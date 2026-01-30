import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  THEME_PRESETS,
  THEME_LIST,
  DEFAULT_THEME,
  getTheme,
  getDefaultAccent,
  findAccentColor,
  getEffectiveAccent,
  themeToCSSProperties,
  systemPrefersDark,
  resolveSystemTheme,
  type AccentColor,
} from "./themes";

describe("themes", () => {
  describe("THEME_PRESETS", () => {
    it("contains 5 theme presets", () => {
      expect(Object.keys(THEME_PRESETS)).toHaveLength(5);
    });

    it("has required themes: paper, midnight, sepia, highContrast, olive", () => {
      expect(THEME_PRESETS).toHaveProperty("paper");
      expect(THEME_PRESETS).toHaveProperty("midnight");
      expect(THEME_PRESETS).toHaveProperty("sepia");
      expect(THEME_PRESETS).toHaveProperty("highContrast");
      expect(THEME_PRESETS).toHaveProperty("olive");
    });

    it("each theme has required color properties", () => {
      const requiredColors = [
        "paper",
        "paperWarm",
        "ink",
        "inkLight",
        "inkMuted",
        "accent",
        "accentSoft",
        "highlight",
        "border",
        "borderStrong",
      ];

      for (const theme of Object.values(THEME_PRESETS)) {
        for (const color of requiredColors) {
          expect(theme.colors).toHaveProperty(color);
          expect(theme.colors[color as keyof typeof theme.colors]).toMatch(
            /^#[0-9a-fA-F]{6}$/
          );
        }
      }
    });

    it("each theme has at least 3 accent color options", () => {
      for (const theme of Object.values(THEME_PRESETS)) {
        expect(theme.accentOptions.length).toBeGreaterThanOrEqual(3);
      }
    });

    it("identifies dark themes correctly", () => {
      expect(THEME_PRESETS.paper.isDark).toBe(false);
      expect(THEME_PRESETS.midnight.isDark).toBe(true);
      expect(THEME_PRESETS.sepia.isDark).toBe(false);
      expect(THEME_PRESETS.highContrast.isDark).toBe(false);
      expect(THEME_PRESETS.olive.isDark).toBe(false);
    });
  });

  describe("THEME_LIST", () => {
    it("contains all themes in display order", () => {
      expect(THEME_LIST).toHaveLength(5);
      expect(THEME_LIST.map((t) => t.id)).toEqual([
        "paper",
        "midnight",
        "sepia",
        "highContrast",
        "olive",
      ]);
    });
  });

  describe("DEFAULT_THEME", () => {
    it("is paper (the default light theme)", () => {
      expect(DEFAULT_THEME).toBe("paper");
    });
  });

  describe("getTheme", () => {
    it("returns the correct theme preset", () => {
      expect(getTheme("paper")).toBe(THEME_PRESETS.paper);
      expect(getTheme("midnight")).toBe(THEME_PRESETS.midnight);
      expect(getTheme("sepia")).toBe(THEME_PRESETS.sepia);
    });
  });

  describe("getDefaultAccent", () => {
    it("returns the first accent option for each theme", () => {
      const paperAccent = getDefaultAccent("paper");
      expect(paperAccent).toBe(THEME_PRESETS.paper.accentOptions[0]);

      const midnightAccent = getDefaultAccent("midnight");
      expect(midnightAccent).toBe(THEME_PRESETS.midnight.accentOptions[0]);
    });
  });

  describe("findAccentColor", () => {
    it("finds accent color by ID within a theme", () => {
      const terracotta = findAccentColor("paper", "terracotta");
      expect(terracotta).toBeDefined();
      expect(terracotta?.name).toBe("Terracotta");
    });

    it("returns undefined for non-existent accent ID", () => {
      const result = findAccentColor("paper", "nonexistent");
      expect(result).toBeUndefined();
    });

    it("returns undefined for accent from wrong theme", () => {
      // "coral" is a midnight accent, not a paper accent
      const result = findAccentColor("paper", "coral");
      expect(result).toBeUndefined();
    });
  });

  describe("getEffectiveAccent", () => {
    it("returns custom accent when valid", () => {
      const result = getEffectiveAccent("paper", "forest");
      expect(result.id).toBe("forest");
      expect(result.name).toBe("Forest");
    });

    it("returns default accent when customAccentId is null", () => {
      const result = getEffectiveAccent("paper", null);
      expect(result).toBe(THEME_PRESETS.paper.accentOptions[0]);
    });

    it("returns default accent when customAccentId is undefined", () => {
      const result = getEffectiveAccent("paper", undefined);
      expect(result).toBe(THEME_PRESETS.paper.accentOptions[0]);
    });

    it("returns default accent when customAccentId is invalid", () => {
      const result = getEffectiveAccent("paper", "invalid-id");
      expect(result).toBe(THEME_PRESETS.paper.accentOptions[0]);
    });
  });

  describe("themeToCSSProperties", () => {
    it("converts theme colors to CSS custom properties", () => {
      const props = themeToCSSProperties(THEME_PRESETS.paper);

      expect(props["--color-paper"]).toBe(THEME_PRESETS.paper.colors.paper);
      expect(props["--color-ink"]).toBe(THEME_PRESETS.paper.colors.ink);
      expect(props["--color-accent"]).toBe(
        THEME_PRESETS.paper.accentOptions[0].color
      );
    });

    it("uses custom accent when provided", () => {
      const customAccent: AccentColor = {
        id: "custom",
        name: "Custom",
        color: "#ff0000",
        soft: "#ffcccc",
      };
      const props = themeToCSSProperties(THEME_PRESETS.paper, customAccent);

      expect(props["--color-accent"]).toBe("#ff0000");
      expect(props["--color-accent-soft"]).toBe("#ffcccc");
    });

    it("includes all required CSS properties", () => {
      const props = themeToCSSProperties(THEME_PRESETS.midnight);

      expect(props).toHaveProperty("--color-paper");
      expect(props).toHaveProperty("--color-paper-warm");
      expect(props).toHaveProperty("--color-ink");
      expect(props).toHaveProperty("--color-ink-light");
      expect(props).toHaveProperty("--color-ink-muted");
      expect(props).toHaveProperty("--color-accent");
      expect(props).toHaveProperty("--color-accent-soft");
      expect(props).toHaveProperty("--color-highlight");
      expect(props).toHaveProperty("--color-border");
      expect(props).toHaveProperty("--color-border-strong");
    });
  });

  describe("systemPrefersDark", () => {
    let matchMediaSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      matchMediaSpy = vi.spyOn(window, "matchMedia");
    });

    it("returns true when system prefers dark mode", () => {
      matchMediaSpy.mockReturnValue({
        matches: true,
      } as MediaQueryList);

      expect(systemPrefersDark()).toBe(true);
    });

    it("returns false when system prefers light mode", () => {
      matchMediaSpy.mockReturnValue({
        matches: false,
      } as MediaQueryList);

      expect(systemPrefersDark()).toBe(false);
    });
  });

  describe("resolveSystemTheme", () => {
    let matchMediaSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      matchMediaSpy = vi.spyOn(window, "matchMedia");
    });

    it("returns midnight when system prefers dark", () => {
      matchMediaSpy.mockReturnValue({
        matches: true,
      } as MediaQueryList);

      expect(resolveSystemTheme()).toBe("midnight");
    });

    it("returns paper when system prefers light", () => {
      matchMediaSpy.mockReturnValue({
        matches: false,
      } as MediaQueryList);

      expect(resolveSystemTheme()).toBe("paper");
    });
  });

  describe("theme color values", () => {
    it("paper theme has warm cream tones", () => {
      const paper = THEME_PRESETS.paper;
      // Should be a light, warm color
      expect(paper.colors.paper).toBe("#faf8f5");
      // Ink should be dark
      expect(paper.colors.ink).toBe("#1a1a1a");
    });

    it("midnight theme has dark tones", () => {
      const midnight = THEME_PRESETS.midnight;
      // Should be dark
      expect(midnight.colors.paper).toBe("#1a1a1a");
      // Ink should be light
      expect(midnight.colors.ink).toBe("#e8e6e3");
    });

    it("sepia theme has aged paper tones", () => {
      const sepia = THEME_PRESETS.sepia;
      // Should be warm/yellow-ish
      expect(sepia.colors.paper).toBe("#f4ecd8");
    });

    it("highContrast theme has pure colors", () => {
      const hc = THEME_PRESETS.highContrast;
      // Pure white background
      expect(hc.colors.paper).toBe("#ffffff");
      // Pure black text
      expect(hc.colors.ink).toBe("#000000");
    });

    it("olive theme has sage/green tones", () => {
      const olive = THEME_PRESETS.olive;
      // Should have a greenish tint
      expect(olive.colors.accent).toBe("#5f7a5e");
    });
  });

  describe("accent color uniqueness", () => {
    it("each theme has unique accent color IDs", () => {
      for (const theme of THEME_LIST) {
        const ids = theme.accentOptions.map((a) => a.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
      }
    });

    it("accent colors have valid hex values", () => {
      const hexPattern = /^#[0-9a-fA-F]{6}$/;
      for (const theme of THEME_LIST) {
        for (const accent of theme.accentOptions) {
          expect(accent.color).toMatch(hexPattern);
          expect(accent.soft).toMatch(hexPattern);
        }
      }
    });
  });
});
