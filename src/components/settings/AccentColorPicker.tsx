import { useCallback } from "react";
import {
  getTheme,
  getDefaultAccent,
  type ThemeName,
  type AccentColor,
} from "@/lib/settings/themes";

interface AccentColorPickerProps {
  /** Current theme name (determines available accent colors) */
  themeName: ThemeName;
  /** Currently selected accent color ID (null = default) */
  selectedAccentId: string | null;
  /** Callback when accent color is selected */
  onSelectAccent: (accentId: string | null) => void;
}

/**
 * AccentColorPicker - Curated accent color swatches
 *
 * Design: Shows a row of color swatches that are carefully curated
 * for each theme. Includes a "reset to default" option.
 */
export function AccentColorPicker({
  themeName,
  selectedAccentId,
  onSelectAccent,
}: AccentColorPickerProps) {
  const theme = getTheme(themeName);
  const defaultAccent = getDefaultAccent(themeName);
  const isDefaultSelected = selectedAccentId === null || selectedAccentId === defaultAccent.id;

  return (
    <div className="accent-picker">
      <div className="accent-picker-swatches">
        {theme.accentOptions.map((accent) => (
          <AccentSwatch
            key={accent.id}
            accent={accent}
            isSelected={
              selectedAccentId === accent.id ||
              (isDefaultSelected && accent.id === defaultAccent.id)
            }
            isDefault={accent.id === defaultAccent.id}
            onSelect={() =>
              onSelectAccent(accent.id === defaultAccent.id ? null : accent.id)
            }
          />
        ))}
      </div>
      {selectedAccentId && selectedAccentId !== defaultAccent.id && (
        <button
          className="accent-picker-reset"
          onClick={() => onSelectAccent(null)}
          aria-label="Reset to default accent color"
        >
          Reset to default
        </button>
      )}
    </div>
  );
}

interface AccentSwatchProps {
  accent: AccentColor;
  isSelected: boolean;
  isDefault: boolean;
  onSelect: () => void;
}

/**
 * Individual accent color swatch
 */
function AccentSwatch({ accent, isSelected, isDefault, onSelect }: AccentSwatchProps) {
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
      className={`accent-swatch ${isSelected ? "selected" : ""}`}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      title={`${accent.name}${isDefault ? " (default)" : ""}`}
      aria-label={`${accent.name} accent color${isDefault ? " (default)" : ""}`}
      role="radio"
      aria-checked={isSelected}
    >
      <span
        className="accent-swatch-color"
        style={{ backgroundColor: accent.color }}
      />
      {isSelected && (
        <span className="accent-swatch-check">
          <CheckIcon />
        </span>
      )}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      width="12"
      height="12"
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
