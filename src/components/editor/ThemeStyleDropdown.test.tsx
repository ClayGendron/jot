import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
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

      // Menu should not be visible (Base UI uses role="menu")
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });

    it("opens dropdown on click", async () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });
    });

    it("closes dropdown when clicking outside", async () => {
      render(
        <div>
          <div data-testid="outside">Outside</div>
          <ThemeStyleDropdown />
        </div>
      );

      // Open dropdown
      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });
      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      // Click outside
      await act(async () => {
        fireEvent.mouseDown(screen.getByTestId("outside"));
      });
      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    });

    it("closes dropdown on Escape key", async () => {
      render(<ThemeStyleDropdown />);

      // Open dropdown
      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });
      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      // Press Escape
      await act(async () => {
        fireEvent.keyDown(document, { key: "Escape" });
      });
      await waitFor(() => {
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
      });
    });

    it("sets aria-expanded correctly", async () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      await act(async () => {
        fireEvent.click(trigger);
      });
      await waitFor(() => {
        expect(trigger).toHaveAttribute("aria-expanded", "true");
      });
    });
  });

  describe("Theme Selection", () => {
    it("displays current theme selection", async () => {
      useEditorStore.setState({ theme: "dark" });
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });

      await waitFor(() => {
        // Dark option should be marked as checked (menuitemradio)
        const darkOption = screen.getByRole("menuitemradio", { name: /dark/i });
        expect(darkOption).toHaveAttribute("aria-checked", "true");
      });
    });

    it("updates theme when selecting light", async () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      const lightOption = screen.getByRole("menuitemradio", { name: /light/i });
      await act(async () => {
        fireEvent.click(lightOption);
      });

      await waitFor(() => {
        expect(useEditorStore.getState().theme).toBe("light");
        expect(mockUpdateAppearance).toHaveBeenCalledWith({ theme: "light" });
      });
    });

    it("updates theme when selecting dark", async () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      const darkOption = screen.getByRole("menuitemradio", { name: /dark/i });
      await act(async () => {
        fireEvent.click(darkOption);
      });

      await waitFor(() => {
        expect(useEditorStore.getState().theme).toBe("dark");
        expect(mockUpdateAppearance).toHaveBeenCalledWith({ theme: "dark" });
      });
    });

    it("updates theme when selecting system", async () => {
      useEditorStore.setState({ theme: "light" });
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      const systemOption = screen.getByRole("menuitemradio", { name: /system/i });
      await act(async () => {
        fireEvent.click(systemOption);
      });

      await waitFor(() => {
        expect(useEditorStore.getState().theme).toBe("system");
        expect(mockUpdateAppearance).toHaveBeenCalledWith({ theme: "system" });
      });
    });
  });

  describe("Font Family Selection", () => {
    it("displays current font family selection", async () => {
      useEditorStore.setState({ fontFamily: "sans" });
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });

      await waitFor(() => {
        // Get the Sans option - it may include description text
        const sansOptions = screen.getAllByRole("menuitemradio");
        const sansOption = sansOptions.find(opt => opt.textContent?.includes("Sans") && opt.textContent?.includes("Open Sans"));
        expect(sansOption).toHaveAttribute("aria-checked", "true");
      });
    });

    it("updates font family when selecting serif", async () => {
      useEditorStore.setState({ fontFamily: "sans" });
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      // Get all menuitemradio elements and find the one with "Serif"
      const menuItems = screen.getAllByRole("menuitemradio");
      const serifOption = menuItems.find(item => item.textContent?.includes("Serif") && item.textContent?.includes("Newsreader"));
      expect(serifOption).toBeTruthy();
      await act(async () => {
        fireEvent.click(serifOption!);
      });

      await waitFor(() => {
        expect(useEditorStore.getState().fontFamily).toBe("serif");
        expect(mockUpdateAppearance).toHaveBeenCalledWith({ fontFamily: "serif" });
      });
    });

    it("updates font family when selecting sans", async () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      const menuItems = screen.getAllByRole("menuitemradio");
      const sansOption = menuItems.find(item => item.textContent?.includes("Sans") && item.textContent?.includes("Open Sans"));
      expect(sansOption).toBeTruthy();
      await act(async () => {
        fireEvent.click(sansOption!);
      });

      await waitFor(() => {
        expect(useEditorStore.getState().fontFamily).toBe("sans");
        expect(mockUpdateAppearance).toHaveBeenCalledWith({ fontFamily: "sans" });
      });
    });

    it("updates font family when selecting mono", async () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });

      await waitFor(() => {
        expect(screen.getByRole("menu")).toBeInTheDocument();
      });

      const menuItems = screen.getAllByRole("menuitemradio");
      const monoOption = menuItems.find(item => item.textContent?.includes("Mono") && item.textContent?.includes("JetBrains"));
      expect(monoOption).toBeTruthy();
      await act(async () => {
        fireEvent.click(monoOption!);
      });

      await waitFor(() => {
        expect(useEditorStore.getState().fontFamily).toBe("mono");
        expect(mockUpdateAppearance).toHaveBeenCalledWith({ fontFamily: "mono" });
      });
    });
  });

  describe("Visual Indicators", () => {
    it("shows theme icon in trigger", () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      // Should contain an SVG icon
      expect(trigger.querySelector("svg")).toBeInTheDocument();
    });

    it("shows section labels in dropdown", async () => {
      render(<ThemeStyleDropdown />);

      const trigger = screen.getByTitle("Appearance settings");
      await act(async () => {
        fireEvent.click(trigger);
      });

      await waitFor(() => {
        expect(screen.getByText("Theme")).toBeInTheDocument();
        expect(screen.getByText("Font")).toBeInTheDocument();
      });
    });
  });
});
