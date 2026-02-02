import { useState, useRef, useEffect, useCallback } from "react";
import { useEditorStore, type FontFamily } from "@/stores/editorStore";
import { useSettingsStore } from "@/stores/settingsStore";

type Theme = "light" | "dark" | "system";

interface ThemeOption {
  value: Theme;
  label: string;
  icon: React.ReactNode;
}

interface FontOption {
  value: FontFamily;
  label: string;
  description: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { value: "light", label: "Light", icon: <SunIcon /> },
  { value: "dark", label: "Dark", icon: <MoonIcon /> },
  { value: "system", label: "System", icon: <MonitorIcon /> },
];

const FONT_OPTIONS: FontOption[] = [
  { value: "serif", label: "Serif", description: "Crimson Pro" },
  { value: "sans", label: "Sans", description: "Open Sans" },
  { value: "mono", label: "Mono", description: "JetBrains Mono" },
];

export function ThemeStyleDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use individual selectors to avoid React 19 + Zustand issues
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);
  const fontFamily = useEditorStore((s) => s.fontFamily);
  const setFontFamily = useEditorStore((s) => s.setFontFamily);

  const updateAppearance = useSettingsStore((s) => s.updateAppearance);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleThemeSelect = useCallback(
    (newTheme: Theme) => {
      setTheme(newTheme);
      updateAppearance({ theme: newTheme });
    },
    [setTheme, updateAppearance]
  );

  const handleFontSelect = useCallback(
    (newFont: FontFamily) => {
      setFontFamily(newFont);
      updateAppearance({ fontFamily: newFont });
    },
    [setFontFamily, updateAppearance]
  );

  const currentThemeOption = THEME_OPTIONS.find((opt) => opt.value === theme);

  return (
    <div className="theme-dropdown" ref={dropdownRef}>
      <button
        className="theme-dropdown-trigger toolbar-button"
        onClick={() => setIsOpen(!isOpen)}
        title="Appearance settings"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {currentThemeOption?.icon ?? <SunIcon />}
      </button>
      {isOpen && (
        <div className="theme-dropdown-menu" role="listbox">
          {/* Theme Section */}
          <div className="theme-dropdown-section">
            <span className="theme-dropdown-label">Theme</span>
            <div className="theme-dropdown-options">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`theme-option ${theme === opt.value ? "active" : ""}`}
                  onClick={() => handleThemeSelect(opt.value)}
                  role="option"
                  aria-selected={theme === opt.value}
                >
                  {opt.icon}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="theme-dropdown-divider" />

          {/* Font Section */}
          <div className="theme-dropdown-section">
            <span className="theme-dropdown-label">Font</span>
            <div className="theme-dropdown-options font-options">
              {FONT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`theme-option font-option ${fontFamily === opt.value ? "active" : ""}`}
                  onClick={() => handleFontSelect(opt.value)}
                  role="option"
                  aria-selected={fontFamily === opt.value}
                  style={{
                    fontFamily:
                      opt.value === "serif"
                        ? "var(--font-serif)"
                        : opt.value === "sans"
                          ? "var(--font-sans)"
                          : "var(--font-mono)",
                  }}
                >
                  <span className="font-label">{opt.label}</span>
                  <span className="font-description">{opt.description}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Icons

function SunIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}
