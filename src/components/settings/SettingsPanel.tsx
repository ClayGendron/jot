import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useEditorStore, type FontFamily } from "@/stores/editorStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useSemanticSearchStore } from "@/stores/semanticSearchStore";
import { indexFolder } from "@/services/semanticIndexingService";
import {
  clampFontSize,
  clampLineHeight,
  clampMaxLineWidth,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  LINE_HEIGHT_MIN,
  LINE_HEIGHT_MAX,
  MAX_LINE_WIDTH_MIN,
  MAX_LINE_WIDTH_MAX,
} from "@/lib/settings/typography";
import { ThemePicker } from "./ThemePicker";
import { AccentColorPicker } from "./AccentColorPicker";
import type { ThemeName } from "@/lib/settings/themes";
import { getTheme } from "@/lib/settings/themes";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type Theme = "light" | "dark" | "system";

/**
 * Settings panel for typography and appearance customization
 *
 * Design: Editorial minimalism - clean, refined controls that feel
 * appropriate for a writing app. Slide-out panel with organized sections.
 */
export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  // Editor store - current values
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);
  const themeName = useEditorStore((s) => s.themeName);
  const setThemeName = useEditorStore((s) => s.setThemeName);
  const accentColorId = useEditorStore((s) => s.accentColorId);
  const setAccentColorId = useEditorStore((s) => s.setAccentColorId);
  const fontFamily = useEditorStore((s) => s.fontFamily);
  const setFontFamily = useEditorStore((s) => s.setFontFamily);
  const fontSize = useEditorStore((s) => s.fontSize);
  const setFontSize = useEditorStore((s) => s.setFontSize);
  const lineHeight = useEditorStore((s) => s.lineHeight);
  const setLineHeight = useEditorStore((s) => s.setLineHeight);
  const maxLineWidth = useEditorStore((s) => s.maxLineWidth);
  const setMaxLineWidth = useEditorStore((s) => s.setMaxLineWidth);
  const typewriterMode = useEditorStore((s) => s.typewriterMode);
  const toggleTypewriterMode = useEditorStore((s) => s.toggleTypewriterMode);
  const focusMode = useEditorStore((s) => s.focusMode);
  const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode);

  // Settings store - persistence and settings values
  const updateAppearance = useSettingsStore((s) => s.updateAppearance);
  const spellCheckEnabled = useSettingsStore(
    (s) => s.appearance?.spellCheckEnabled ?? true
  );

  // Theme change handler (legacy light/dark/system)
  const handleThemeChange = useCallback(
    (newTheme: Theme) => {
      setTheme(newTheme);
      updateAppearance({ theme: newTheme });
    },
    [setTheme, updateAppearance]
  );

  // Theme preset change handler
  const handleThemeNameChange = useCallback(
    (newThemeName: ThemeName) => {
      setThemeName(newThemeName);
      // Also update legacy theme for backwards compatibility
      const themePreset = getTheme(newThemeName);
      const legacyTheme: Theme = themePreset.isDark ? "dark" : "light";
      setTheme(legacyTheme);
      updateAppearance({ themeName: newThemeName, theme: legacyTheme });
    },
    [setThemeName, setTheme, updateAppearance]
  );

  // Accent color change handler
  const handleAccentColorChange = useCallback(
    (newAccentId: string | null) => {
      setAccentColorId(newAccentId);
      updateAppearance({ accentColorId: newAccentId });
    },
    [setAccentColorId, updateAppearance]
  );

  // Font family change handler
  const handleFontFamilyChange = useCallback(
    (newFont: FontFamily) => {
      setFontFamily(newFont);
      updateAppearance({ fontFamily: newFont });
    },
    [setFontFamily, updateAppearance]
  );

  // Font size change handler
  const handleFontSizeChange = useCallback(
    (value: number) => {
      const clamped = clampFontSize(value);
      setFontSize(clamped);
      updateAppearance({ fontSize: clamped });
    },
    [setFontSize, updateAppearance]
  );

  // Line height change handler
  const handleLineHeightChange = useCallback(
    (value: number) => {
      const clamped = clampLineHeight(value);
      setLineHeight(clamped);
      updateAppearance({ lineHeight: clamped });
    },
    [setLineHeight, updateAppearance]
  );

  // Max line width change handler
  const handleMaxLineWidthChange = useCallback(
    (value: number) => {
      const clamped = clampMaxLineWidth(value);
      setMaxLineWidth(clamped);
      updateAppearance({ maxLineWidth: clamped });
    },
    [setMaxLineWidth, updateAppearance]
  );

  // Typewriter mode toggle handler
  const handleTypewriterModeToggle = useCallback(() => {
    toggleTypewriterMode();
    updateAppearance({ typewriterMode: !typewriterMode });
  }, [toggleTypewriterMode, typewriterMode, updateAppearance]);

  // Focus mode toggle handler (not persisted, session-only)
  const handleFocusModeToggle = useCallback(() => {
    toggleFocusMode();
  }, [toggleFocusMode]);

  // Spell check toggle handler
  const handleSpellCheckToggle = useCallback(() => {
    updateAppearance({ spellCheckEnabled: !spellCheckEnabled });
  }, [spellCheckEnabled, updateAppearance]);

  // Semantic search store
  const semanticEnabled = useSemanticSearchStore((s) => s.enabled);
  const semanticModelLoaded = useSemanticSearchStore((s) => s.modelLoaded);
  const indexedFolders = useSemanticSearchStore((s) => s.indexedFolders);
  const isIndexing = useSemanticSearchStore((s) => s.isIndexing);
  const indexingProgress = useSemanticSearchStore((s) => s.indexingProgress);
  const showSetup = useSemanticSearchStore((s) => s.showSetup);
  const disableSemanticSearch = useSemanticSearchStore((s) => s.disableSemanticSearch);
  const removeFolder = useSemanticSearchStore((s) => s.removeFolder);

  // Local state for rebuild confirmation
  const [isRebuilding, setIsRebuilding] = useState(false);

  // Handle semantic search toggle
  const handleSemanticToggle = useCallback(() => {
    if (semanticEnabled) {
      // Disable semantic search
      disableSemanticSearch();
    } else {
      // Show setup dialog
      showSetup();
      onClose();
    }
  }, [semanticEnabled, disableSemanticSearch, showSetup, onClose]);

  // Handle folder removal
  const handleRemoveFolder = useCallback(
    async (path: string) => {
      const confirmed = window.confirm(
        "Remove this folder from semantic search? Embeddings for this folder will be deleted."
      );
      if (confirmed) {
        await removeFolder(path);
      }
    },
    [removeFolder]
  );

  // Handle rebuild index
  const handleRebuildIndex = useCallback(async () => {
    if (isRebuilding || isIndexing) return;

    setIsRebuilding(true);
    try {
      for (const folder of indexedFolders) {
        await indexFolder(folder.path);
      }
    } catch (err) {
      console.error("Failed to rebuild index:", err);
    } finally {
      setIsRebuilding(false);
    }
  }, [isRebuilding, isIndexing, indexedFolders]);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[360px] max-w-full p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="flex-row items-center justify-between px-6 py-5 border-b border-border">
          <SheetTitle className="font-serif text-xl font-semibold tracking-tight">
            Settings
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X className="size-5" />
          </Button>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* Appearance Section */}
          <Section title="Appearance">
            {/* Theme Picker */}
            <Row vertical>
              <Label>Theme</Label>
              <ThemePicker
                selectedTheme={themeName}
                onSelectTheme={handleThemeNameChange}
              />
            </Row>

            {/* Accent Color */}
            <Row vertical>
              <Label>Accent color</Label>
              <AccentColorPicker
                themeName={themeName}
                selectedAccentId={accentColorId}
                onSelectAccent={handleAccentColorChange}
              />
            </Row>

            {/* System preference toggle */}
            <ToggleRow
              label="Follow system"
              description="Automatically switch themes based on system preference"
              checked={theme === "system"}
              onCheckedChange={(checked) => handleThemeChange(checked ? "system" : "light")}
            />
          </Section>

          {/* Typography Section */}
          <Section title="Typography">
            {/* Font Family */}
            <Row>
              <Label>Font</Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  active={fontFamily === "serif"}
                  onClick={() => handleFontFamilyChange("serif")}
                  className="flex-1"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  Serif
                </Button>
                <Button
                  variant="outline"
                  active={fontFamily === "sans"}
                  onClick={() => handleFontFamilyChange("sans")}
                  className="flex-1"
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Sans
                </Button>
                <Button
                  variant="outline"
                  active={fontFamily === "mono"}
                  onClick={() => handleFontFamilyChange("mono")}
                  className="flex-1"
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Mono
                </Button>
              </div>
            </Row>

            {/* Font Size */}
            <Row>
              <Label>
                Size
                <span className="font-normal text-xs text-muted-foreground font-mono">
                  {fontSize}px
                </span>
              </Label>
              <SliderRow
                min={FONT_SIZE_MIN}
                max={FONT_SIZE_MAX}
                step={1}
                value={fontSize}
                onChange={handleFontSizeChange}
                leftIcon={<span className="text-xs">A</span>}
                rightIcon={<span className="text-sm">A</span>}
              />
            </Row>

            {/* Line Height */}
            <Row>
              <Label>
                Line spacing
                <span className="font-normal text-xs text-muted-foreground font-mono">
                  {lineHeight.toFixed(1)}
                </span>
              </Label>
              <SliderRow
                min={LINE_HEIGHT_MIN}
                max={LINE_HEIGHT_MAX}
                step={0.1}
                value={lineHeight}
                onChange={handleLineHeightChange}
                leftIcon={<LineSpacingIcon tight />}
                rightIcon={<LineSpacingIcon />}
              />
            </Row>

            {/* Max Line Width */}
            <Row>
              <Label>
                Line width
                <span className="font-normal text-xs text-muted-foreground font-mono">
                  {maxLineWidth} ch
                </span>
              </Label>
              <SliderRow
                min={MAX_LINE_WIDTH_MIN}
                max={MAX_LINE_WIDTH_MAX}
                step={4}
                value={maxLineWidth}
                onChange={handleMaxLineWidthChange}
                leftIcon={<LineWidthIcon narrow />}
                rightIcon={<LineWidthIcon />}
              />
            </Row>
          </Section>

          {/* Editor Section */}
          <Section title="Editor">
            <ToggleRow
              label="Focus mode"
              description="Dim text except the current paragraph"
              checked={focusMode}
              onCheckedChange={handleFocusModeToggle}
            />

            <ToggleRow
              label="Typewriter mode"
              description="Keep current line centered vertically"
              checked={typewriterMode}
              onCheckedChange={handleTypewriterModeToggle}
            />

            <ToggleRow
              label="Spell check"
              description="Highlight misspelled words as you type"
              checked={spellCheckEnabled}
              onCheckedChange={handleSpellCheckToggle}
            />
          </Section>

          {/* Semantic Search Section */}
          <Section title="Semantic Search">
            <ToggleRow
              label="Enable semantic search"
              description="Search by meaning across indexed folders"
              checked={semanticEnabled}
              onCheckedChange={handleSemanticToggle}
            />

            {semanticEnabled && (
              <>
                {/* Model Status */}
                <Row>
                  <Label>Model status</Label>
                  <span
                    className={`text-sm font-medium ${
                      semanticModelLoaded ? "text-green-600" : "text-amber-600"
                    }`}
                  >
                    {semanticModelLoaded ? "Ready" : "Loading..."}
                  </span>
                </Row>

                {/* Indexed Folders */}
                <Row vertical>
                  <Label>Indexed folders</Label>
                  {indexedFolders.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      No folders indexed yet
                    </span>
                  ) : (
                    <div className="space-y-2">
                      {indexedFolders.map((folder) => (
                        <div
                          key={folder.path}
                          className="flex items-center gap-2 p-2 rounded-md bg-muted/50"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">
                              {folder.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {folder.path}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => handleRemoveFolder(folder.path)}
                            title="Remove from index"
                            className="opacity-50 hover:opacity-100"
                          >
                            <X className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Row>

                {/* Add Folder Button */}
                <Row>
                  <Button
                    variant="outline"
                    onClick={() => {
                      showSetup();
                      onClose();
                    }}
                  >
                    Add folder...
                  </Button>
                </Row>

                {/* Rebuild Index */}
                <Row>
                  <Label>Index</Label>
                  <Button
                    variant="outline"
                    onClick={handleRebuildIndex}
                    disabled={isRebuilding || isIndexing || indexedFolders.length === 0}
                  >
                    {isRebuilding || isIndexing ? (
                      <>
                        Rebuilding...
                        {indexingProgress && (
                          <span className="text-muted-foreground">
                            {" "}({indexingProgress.current}/{indexingProgress.total})
                          </span>
                        )}
                      </>
                    ) : (
                      "Rebuild index"
                    )}
                  </Button>
                </Row>

                {/* Shortcut Info */}
                <Row>
                  <span className="text-xs text-muted-foreground">
                    Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⌘</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⇧</kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">Space</kbd> to open semantic search
                  </span>
                </Row>
              </>
            )}
          </Section>

          {/* Keyboard Shortcuts Info */}
          <Section title="Shortcuts" className="border-t-0">
            <div className="space-y-2">
              <ShortcutRow keys={["⌘", "+"]} label="Increase font size" />
              <ShortcutRow keys={["⌘", "-"]} label="Decrease font size" />
              <ShortcutRow keys={["⌘", "0"]} label="Reset font size" />
            </div>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Helper Components

function Section({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`px-6 py-3 border-t border-border first:border-t-0 ${className || ""}`}>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({
  children,
  vertical,
}: {
  children: React.ReactNode;
  vertical?: boolean;
}) {
  return (
    <div className={`mb-4 last:mb-0 ${vertical ? "space-y-2" : ""}`}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="flex items-baseline justify-between text-sm font-medium text-foreground mb-2">
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4 last:mb-0">
      <div className="flex-1">
        <label className="text-sm font-medium text-foreground">{label}</label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SliderRow({
  min,
  max,
  step,
  value,
  onChange,
  leftIcon,
  rightIcon,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  leftIcon: React.ReactNode;
  rightIcon: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        type="range"
        className="w-full h-1 rounded bg-border appearance-none cursor-pointer accent-accent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent [&::-webkit-slider-thumb]:shadow-sm [&::-webkit-slider-thumb]:cursor-pointer"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="flex justify-between mt-1 text-muted-foreground">
        {leftIcon}
        {rightIcon}
      </div>
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex gap-1">
        {keys.map((key, i) => (
          <kbd
            key={i}
            className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono"
          >
            {key}
          </kbd>
        ))}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

// Icons

function LineSpacingIcon({ tight }: { tight?: boolean }) {
  const gap = tight ? 4 : 8;
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1={12 - gap} x2="20" y2={12 - gap} />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1={12 + gap} x2="20" y2={12 + gap} />
    </svg>
  );
}

function LineWidthIcon({ narrow }: { narrow?: boolean }) {
  const width = narrow ? 12 : 18;
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1={(24 - width) / 2} y1="6" x2={(24 + width) / 2} y2="6" />
      <line x1={(24 - width) / 2} y1="12" x2={(24 + width) / 2} y2="12" />
      <line x1={(24 - width) / 2} y1="18" x2={(24 + width) / 2} y2="18" />
    </svg>
  );
}
