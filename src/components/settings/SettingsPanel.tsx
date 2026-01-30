import { useCallback } from "react";
import { useEditorStore, type FontFamily } from "@/stores/editorStore";
import { useSettingsStore } from "@/stores/settingsStore";
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

  // Settings store - persistence
  const updateAppearance = useSettingsStore((s) => s.updateAppearance);

  // Theme change handler
  const handleThemeChange = useCallback(
    (newTheme: Theme) => {
      setTheme(newTheme);
      updateAppearance({ theme: newTheme });
    },
    [setTheme, updateAppearance]
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
            <CloseIcon />
          </button>
        </header>

        <div className="settings-panel-content">
          {/* Appearance Section */}
          <section className="settings-section">
            <h3 className="settings-section-title">Appearance</h3>

            {/* Theme */}
            <div className="settings-row">
              <label className="settings-label">Theme</label>
              <div className="settings-button-group">
                <button
                  className={`settings-button ${theme === "light" ? "active" : ""}`}
                  onClick={() => handleThemeChange("light")}
                >
                  <SunIcon />
                  Light
                </button>
                <button
                  className={`settings-button ${theme === "dark" ? "active" : ""}`}
                  onClick={() => handleThemeChange("dark")}
                >
                  <MoonIcon />
                  Dark
                </button>
                <button
                  className={`settings-button ${theme === "system" ? "active" : ""}`}
                  onClick={() => handleThemeChange("system")}
                >
                  <MonitorIcon />
                  System
                </button>
              </div>
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

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

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
