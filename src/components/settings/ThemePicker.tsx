import { useCallback } from "react";
import { Check, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="grid grid-cols-3 gap-2">
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
      className={cn(
        "relative border-2 border-[var(--color-border)] rounded-lg overflow-hidden cursor-pointer transition-all",
        "hover:border-[var(--color-border-strong)] hover:-translate-y-0.5 hover:shadow-sm",
        isSelected && "border-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent)]"
      )}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      role="radio"
      aria-checked={isSelected}
      aria-label={`${theme.name} theme: ${theme.description}`}
    >
      {/* Color preview swatch */}
      <div
        className="relative h-12 p-2"
        style={{ backgroundColor: theme.colors.paper }}
      >
        {/* Sample text lines */}
        <div
          className="h-1.5 rounded-sm mb-1.5"
          style={{ backgroundColor: theme.colors.ink, width: "60%" }}
        />
        <div
          className="h-1 rounded-sm mb-1 opacity-50"
          style={{ backgroundColor: theme.colors.inkLight, width: "80%" }}
        />
        <div
          className="h-1 rounded-sm opacity-50"
          style={{ backgroundColor: theme.colors.inkLight, width: "50%" }}
        />
        {/* Accent indicator */}
        <div
          className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: theme.colors.accent }}
        />
      </div>

      {/* Theme info */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--color-paper-warm)]">
        <span className="font-sans text-xs font-medium text-[var(--color-ink)]">{theme.name}</span>
        {theme.isDark && <Moon className="h-3 w-3 text-[var(--color-ink-muted)]" />}
      </div>

      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}
    </button>
  );
}
