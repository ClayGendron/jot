import { useCallback } from "react";
import { Check, Moon } from "lucide-react";
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
        {theme.isDark && <Moon className="h-3 w-3 theme-card-dark-icon" />}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="theme-card-check">
          <Check className="h-4 w-4" />
        </div>
      )}
    </button>
  );
}
