import { useCallback, useState } from "react";
import { X } from "lucide-react";
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
  onClose: () => void;
}

type Theme = "light" | "dark" | "system";

/**
 * Settings panel for typography and appearance customization
 *
 * Design: Editorial minimalism - clean, refined controls that feel
 * appropriate for a writing app. Slide-out panel with organized sections.
 */
export function SettingsPanel({ onClose }: SettingsPanelProps) {
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
  // Grammar check disabled - see docs/GRAMMAR_CHECK_IMPLEMENTATION.md
  // const grammarCheckEnabled = useSettingsStore(
  //   (s) => s.appearance?.grammarCheckEnabled ?? true
  // );
  // const grammarDialect = useSettingsStore(
  //   (s) => s.appearance?.grammarDialect ?? "american"
  // );

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

  // Grammar check disabled - see docs/GRAMMAR_CHECK_IMPLEMENTATION.md
  // const handleGrammarCheckToggle = useCallback(() => {
  //   updateAppearance({ grammarCheckEnabled: !grammarCheckEnabled });
  // }, [grammarCheckEnabled, updateAppearance]);
  // const handleGrammarDialectChange = useCallback(
  //   (dialect: "american" | "british" | "canadian" | "australian") => {
  //     updateAppearance({ grammarDialect: dialect });
  //   },
  //   [updateAppearance]
  // );

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
    <div className="settings-panel-overlay" onClick={onClose}>
      <aside
        className="settings-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <header className="settings-panel-header">
          <h2 className="settings-panel-title">Settings</h2>
          <button
            className="settings-panel-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="settings-panel-content">
          {/* Appearance Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>

            {/* Theme Picker */}
            <div className="settings-row settings-row-vertical">
              <label className="settings-label">Theme</label>
              <ThemePicker
                selectedTheme={themeName}
                onSelectTheme={handleThemeNameChange}
              />
            </div>

            {/* Accent Color */}
            <div className="settings-row settings-row-vertical">
              <label className="settings-label">Accent color</label>
              <AccentColorPicker
                themeName={themeName}
                selectedAccentId={accentColorId}
                onSelectAccent={handleAccentColorChange}
              />
            </div>

            {/* System preference toggle */}
            <div className="settings-row toggle-row">
              <div className="settings-toggle-info">
                <label className="settings-label">Follow system</label>
                <span className="settings-description">
                  Automatically switch themes based on system preference
                </span>
              </div>
              <button
                className={`settings-toggle ${theme === "system" ? "active" : ""}`}
                onClick={() => handleThemeChange(theme === "system" ? "light" : "system")}
                role="switch"
                aria-checked={theme === "system"}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>
          </section>

          {/* Typography Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">Typography</h3>

            {/* Font Family */}
            <div className="settings-row">
              <label className="settings-label">Font</label>
              <div className="settings-button-group font-group">
                <button
                  className={`settings-button font-button ${fontFamily === "serif" ? "active" : ""}`}
                  onClick={() => handleFontFamilyChange("serif")}
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  Serif
                </button>
                <button
                  className={`settings-button font-button ${fontFamily === "sans" ? "active" : ""}`}
                  onClick={() => handleFontFamilyChange("sans")}
                  style={{ fontFamily: "var(--font-sans)" }}
                >
                  Sans
                </button>
                <button
                  className={`settings-button font-button ${fontFamily === "mono" ? "active" : ""}`}
                  onClick={() => handleFontFamilyChange("mono")}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  Mono
                </button>
              </div>
            </div>

            {/* Font Size */}
            <div className="settings-row">
              <label className="settings-label">
                Size
                <span className="settings-value">{fontSize}px</span>
              </label>
              <div className="settings-slider-container">
                <input
                  type="range"
                  className="settings-slider"
                  min={FONT_SIZE_MIN}
                  max={FONT_SIZE_MAX}
                  step={1}
                  value={fontSize}
                  onChange={(e) => handleFontSizeChange(Number(e.target.value))}
                />
                <div className="settings-slider-labels">
                  <span>A</span>
                  <span style={{ fontSize: "1.25em" }}>A</span>
                </div>
              </div>
            </div>

            {/* Line Height */}
            <div className="settings-row">
              <label className="settings-label">
                Line spacing
                <span className="settings-value">{lineHeight.toFixed(1)}</span>
              </label>
              <div className="settings-slider-container">
                <input
                  type="range"
                  className="settings-slider"
                  min={LINE_HEIGHT_MIN}
                  max={LINE_HEIGHT_MAX}
                  step={0.1}
                  value={lineHeight}
                  onChange={(e) => handleLineHeightChange(Number(e.target.value))}
                />
                <div className="settings-slider-labels">
                  <LineSpacingIcon tight />
                  <LineSpacingIcon />
                </div>
              </div>
            </div>

            {/* Max Line Width */}
            <div className="settings-row">
              <label className="settings-label">
                Line width
                <span className="settings-value">{maxLineWidth} ch</span>
              </label>
              <div className="settings-slider-container">
                <input
                  type="range"
                  className="settings-slider"
                  min={MAX_LINE_WIDTH_MIN}
                  max={MAX_LINE_WIDTH_MAX}
                  step={4}
                  value={maxLineWidth}
                  onChange={(e) => handleMaxLineWidthChange(Number(e.target.value))}
                />
                <div className="settings-slider-labels">
                  <LineWidthIcon narrow />
                  <LineWidthIcon />
                </div>
              </div>
            </div>
          </section>

          {/* Editor Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">Editor</h3>

            {/* Focus Mode */}
            <div className="settings-row toggle-row">
              <div className="settings-toggle-info">
                <label className="settings-label">Focus mode</label>
                <span className="settings-description">
                  Dim text except the current paragraph
                </span>
              </div>
              <button
                className={`settings-toggle ${focusMode ? "active" : ""}`}
                onClick={handleFocusModeToggle}
                role="switch"
                aria-checked={focusMode}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>

            {/* Typewriter Mode */}
            <div className="settings-row toggle-row">
              <div className="settings-toggle-info">
                <label className="settings-label">Typewriter mode</label>
                <span className="settings-description">
                  Keep current line centered vertically
                </span>
              </div>
              <button
                className={`settings-toggle ${typewriterMode ? "active" : ""}`}
                onClick={handleTypewriterModeToggle}
                role="switch"
                aria-checked={typewriterMode}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>

            {/* Spell Check */}
            <div className="settings-row toggle-row">
              <div className="settings-toggle-info">
                <label className="settings-label">Spell check</label>
                <span className="settings-description">
                  Highlight misspelled words as you type
                </span>
              </div>
              <button
                className={`settings-toggle ${spellCheckEnabled ? "active" : ""}`}
                onClick={handleSpellCheckToggle}
                role="switch"
                aria-checked={spellCheckEnabled}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>

            {/* Grammar Check - disabled, see docs/GRAMMAR_CHECK_IMPLEMENTATION.md */}
          </section>

          {/* Semantic Search Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">Semantic Search</h3>

            {/* Enable/Disable Toggle */}
            <div className="settings-row toggle-row">
              <div className="settings-toggle-info">
                <label className="settings-label">Enable semantic search</label>
                <span className="settings-description">
                  Search by meaning across indexed folders
                </span>
              </div>
              <button
                className={`settings-toggle ${semanticEnabled ? "active" : ""}`}
                onClick={handleSemanticToggle}
                role="switch"
                aria-checked={semanticEnabled}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>

            {semanticEnabled && (
              <>
                {/* Model Status */}
                <div className="settings-row">
                  <label className="settings-label">Model status</label>
                  <span className={`settings-status ${semanticModelLoaded ? "success" : "pending"}`}>
                    {semanticModelLoaded ? "Ready" : "Loading..."}
                  </span>
                </div>

                {/* Indexed Folders */}
                <div className="settings-row settings-row-vertical">
                  <label className="settings-label">Indexed folders</label>
                  {indexedFolders.length === 0 ? (
                    <span className="settings-description">
                      No folders indexed yet
                    </span>
                  ) : (
                    <div className="settings-folder-list">
                      {indexedFolders.map((folder) => (
                        <div key={folder.path} className="settings-folder-item">
                          <span className="settings-folder-name">{folder.name}</span>
                          <span className="settings-folder-path">{folder.path}</span>
                          <button
                            className="settings-folder-remove"
                            onClick={() => handleRemoveFolder(folder.path)}
                            title="Remove from index"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Add Folder Button */}
                <div className="settings-row">
                  <button
                    className="settings-button-secondary"
                    onClick={() => {
                      showSetup();
                      onClose();
                    }}
                  >
                    Add folder...
                  </button>
                </div>

                {/* Rebuild Index */}
                <div className="settings-row">
                  <label className="settings-label">Index</label>
                  <button
                    className="settings-button-secondary"
                    onClick={handleRebuildIndex}
                    disabled={isRebuilding || isIndexing || indexedFolders.length === 0}
                  >
                    {isRebuilding || isIndexing ? (
                      <>
                        Rebuilding...
                        {indexingProgress && (
                          <span className="settings-progress">
                            {" "}({indexingProgress.current}/{indexingProgress.total})
                          </span>
                        )}
                      </>
                    ) : (
                      "Rebuild index"
                    )}
                  </button>
                </div>

                {/* Shortcut Info */}
                <div className="settings-row">
                  <span className="settings-description">
                    Press <kbd>⌘</kbd><kbd>⇧</kbd><kbd>Space</kbd> to open semantic search
                  </span>
                </div>
              </>
            )}
          </section>

          {/* Keyboard Shortcuts Info */}
          <section className="settings-section settings-shortcuts">
            <h3 className="settings-section-title">Shortcuts</h3>
            <div className="settings-shortcut-list">
              <div className="settings-shortcut">
                <span className="settings-shortcut-keys">
                  <kbd>⌘</kbd><kbd>+</kbd>
                </span>
                <span>Increase font size</span>
              </div>
              <div className="settings-shortcut">
                <span className="settings-shortcut-keys">
                  <kbd>⌘</kbd><kbd>-</kbd>
                </span>
                <span>Decrease font size</span>
              </div>
              <div className="settings-shortcut">
                <span className="settings-shortcut-keys">
                  <kbd>⌘</kbd><kbd>0</kbd>
                </span>
                <span>Reset font size</span>
              </div>
            </div>
          </section>
        </div>
      </aside>
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
