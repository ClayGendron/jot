import { useCallback } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
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
          className="font-sans text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] cursor-pointer bg-transparent border-none p-0 text-left transition-colors"
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
      className={cn(
        "relative w-8 h-8 rounded-full border-2 border-transparent cursor-pointer transition-transform",
        "hover:scale-110",
        isSelected && "border-[var(--color-ink)]"
      )}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      title={`${accent.name}${isDefault ? " (default)" : ""}`}
      aria-label={`${accent.name} accent color${isDefault ? " (default)" : ""}`}
      role="radio"
      aria-checked={isSelected}
    >
      <span
        className="block w-6 h-6 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]"
        style={{ backgroundColor: accent.color }}
      />
      {isSelected && (
        <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)]">
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
