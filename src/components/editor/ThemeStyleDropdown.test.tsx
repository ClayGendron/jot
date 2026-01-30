import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeStyleDropdown } from "./ThemeStyleDropdown";
import { useEditorStore } from "@/stores/editorStore";

// Mock the settings store with a proper implementation
const mockUpdateAppearance = vi.fn();
vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: vi.fn((selector) => {
    const state = {
      updateAppearance: mockUpdateAppearance,
    };
    // If selector is a function, call it with the state
    if (typeof selector === "function") {
      return selector(state);
    }
    return state;
  }),
}));

describe("ThemeStyleDropdown", () => {
  beforeEach(() => {
    // Reset editor store to initial state
    useEditorStore.setState({
      theme: "system",
      fontFamily: "serif",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockUpdateAppearance.mockClear();
  });

  describe("Dropdown Behavior", () => {
    it("renders closed by default", () => {
      render(<ThemeStyleDropdown />);

      // Trigger button should be visible
      expect(screen.getByTitle("Appearance settings")).toBeInTheDocument();

      // Menu should not be visible
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("opens dropdown on click", () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);

      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("closes dropdown when clicking outside", () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <ThemeStyleDropdown />
        </div>
      );

      // Open dropdown
      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(screen.getByTestId("outside"));
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("closes dropdown on Escape key", () => {
      render(<ThemeStyleDropdown />);

      // Open dropdown
      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("sets aria-expanded correctly", () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Theme Selection", () => {
    it("displays current theme selection", () => {
      useEditorStore.setState({ theme: "dark" });
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);

      // Dark option should be marked as selected
      const darkOption = screen.getByRole("option", { name: /dark/i });
      expect(darkOption).toHaveAttribute("aria-selected", "true");
    });

    it("updates theme when selecting light", () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);

      const lightOption = screen.getByRole("option", { name: /light/i });
      fireEvent.click(lightOption);

      expect(useEditorStore.getState().theme).toBe("light");
      expect(mockUpdateAppearance).toHaveBeenCalledWith({ theme: "light" });
    });

    it("updates theme when selecting dark", () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);

      const darkOption = screen.getByRole("option", { name: /dark/i });
      fireEvent.click(darkOption);

      expect(useEditorStore.getState().theme).toBe("dark");
      expect(mockUpdateAppearance).toHaveBeenCalledWith({ theme: "dark" });
    });

    it("updates theme when selecting system", () => {
      useEditorStore.setState({ theme: "light" });
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);

      const systemOption = screen.getByRole("option", { name: /system/i });
      fireEvent.click(systemOption);

      expect(useEditorStore.getState().theme).toBe("system");
      expect(mockUpdateAppearance).toHaveBeenCalledWith({ theme: "system" });
    });
  });

  describe("Font Family Selection", () => {
    it("displays current font family selection", () => {
      useEditorStore.setState({ fontFamily: "sans" });
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);

      const sansOption = screen.getByRole("option", { name: /sans/i });
      expect(sansOption).toHaveAttribute("aria-selected", "true");
    });

    it("updates font family when selecting serif", () => {
      useEditorStore.setState({ fontFamily: "sans" });
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);

      const serifOption = screen.getByRole("option", { name: /serif/i });
      fireEvent.click(serifOption);

      expect(useEditorStore.getState().fontFamily).toBe("serif");
      expect(mockUpdateAppearance).toHaveBeenCalledWith({ fontFamily: "serif" });
    });

    it("updates font family when selecting sans", () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);

      const sansOption = screen.getByRole("option", { name: /sans/i });
      fireEvent.click(sansOption);

      expect(useEditorStore.getState().fontFamily).toBe("sans");
      expect(mockUpdateAppearance).toHaveBeenCalledWith({ fontFamily: "sans" });
    });

    it("updates font family when selecting mono", () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);

      const monoOption = screen.getByRole("option", { name: /mono/i });
      fireEvent.click(monoOption);

      expect(useEditorStore.getState().fontFamily).toBe("mono");
      expect(mockUpdateAppearance).toHaveBeenCalledWith({ fontFamily: "mono" });
    });
  });

  describe("Visual Indicators", () => {
    it("shows theme icon in trigger", () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      // Should contain an SVG icon
      expect(trigger.querySelector("svg")).toBeInTheDocument();
    });

    it("shows section labels in dropdown", () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      fireEvent.click(trigger);

      expect(screen.getByText("Theme")).toBeInTheDocument();
      expect(screen.getByText("Font")).toBeInTheDocument();
    });
  });
});
