import { useCallback } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useEditorStore, type FontFamily } from "@/stores/editorStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

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
  { value: "light", label: "Light", icon: <Sun className="size-4" /> },
  { value: "dark", label: "Dark", icon: <Moon className="size-4" /> },
  { value: "system", label: "System", icon: <Monitor className="size-4" /> },
];

const FONT_OPTIONS: FontOption[] = [
  { value: "serif", label: "Serif", description: "Crimson Pro" },
  { value: "sans", label: "Sans", description: "Open Sans" },
  { value: "mono", label: "Mono", description: "JetBrains Mono" },
];

export function ThemeStyleDropdown() {
  // Use individual selectors to avoid React 19 + Zustand issues
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);
  const fontFamily = useEditorStore((s) => s.fontFamily);
  const setFontFamily = useEditorStore((s) => s.setFontFamily);

  const updateAppearance = useSettingsStore((s) => s.updateAppearance);

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
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            title="Appearance settings"
          />
        }
      >
        {currentThemeOption?.icon ?? <Sun className="size-4" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {/* Theme Section */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => handleThemeSelect(value as Theme)}
          >
            {THEME_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                {opt.icon}
                <span>{opt.label}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Font Section */}
        <DropdownMenuGroup>
          <DropdownMenuLabel>Font</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={fontFamily}
            onValueChange={(value) => handleFontSelect(value as FontFamily)}
          >
            {FONT_OPTIONS.map((opt) => (
              <DropdownMenuRadioItem
                key={opt.value}
                value={opt.value}
                className="flex-col items-start"
                style={{
                  fontFamily:
                    opt.value === "serif"
                      ? "var(--font-serif)"
                      : opt.value === "sans"
                        ? "var(--font-sans)"
                        : "var(--font-mono)",
                }}
              >
                <span className="font-medium">{opt.label}</span>
                <span className="text-xs text-muted-foreground">
                  {opt.description}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
