import { useCallback } from "react";
import { THEME_LIST, type ThemePreset, type ThemeName } from "@/lib/settings/themes";

interface ThemePickerProps {
  /** Currently selected theme name */
  selectedTheme: ThemeName;
  /** Callback when theme is selected */
  onSelectTheme: (themeName: ThemeName) => void;
}

/**
 * ThemePicker - Visual theme selector with preview cards
 *
 * Design: Each theme is displayed as a card showing a preview of its
 * color palette. Cards are arranged in a grid with smooth hover effects.
 */
export function ThemePicker({ selectedTheme, onSelectTheme }: ThemePickerProps) {
  return (
    <div className="theme-picker">
      {THEME_LIST.map((theme) => (
        <ThemeCard
          key={theme.id}
          theme={theme}
          isSelected={selectedTheme === theme.id}
          onSelect={() => onSelectTheme(theme.id)}
        />
      ))}
    </div>
  );
}

interface ThemeCardProps {
  theme: ThemePreset;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * Individual theme card showing color preview
 */
function ThemeCard({ theme, isSelected, onSelect }: ThemeCardProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    },
    [onSelect]
  );

  return (
    <button
      className={`theme-card ${isSelected ? "selected" : ""}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="radio"
      aria-checked={isSelected}
      aria-label={`${theme.name} theme: ${theme.description}`}
    >
      {/* Color preview swatch */}
      <div
        className="theme-card-preview"
        style={{ backgroundColor: theme.colors.paper }}
      >
        {/* Sample text lines */}
        <div
          className="theme-card-line theme-card-line-title"
          style={{ backgroundColor: theme.colors.ink }}
        />
        <div
          className="theme-card-line theme-card-line-text"
          style={{ backgroundColor: theme.colors.inkLight }}
        />
        <div
          className="theme-card-line theme-card-line-text short"
          style={{ backgroundColor: theme.colors.inkLight }}
        />
        {/* Accent indicator */}
        <div
          className="theme-card-accent"
          style={{ backgroundColor: theme.colors.accent }}
        />
      </div>

      {/* Theme info */}
      <div className="theme-card-info">
        <span className="theme-card-name">{theme.name}</span>
        {theme.isDark && <MoonIcon />}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="theme-card-check">
          <CheckIcon />
        </div>
      )}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="theme-card-dark-icon"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}
