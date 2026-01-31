/**
 * Editor Context Menu Component
 *
 * Provides right-click context menu for the editor with options to copy
 * content in different formats (formatted/rich text or markdown).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { copyAsFormatted, copyAsMarkdown } from "@/lib/clipboard/copyFormatted";
import { useSettingsStore } from "@/stores/settingsStore";

interface EditorContextMenuProps {
  /** Position to show the menu */
  position: { x: number; y: number };
  /** TipTap editor instance */
  editor: Editor;
  /** Callback when menu should be dismissed */
  onDismiss: () => void;
}

const COPY_SUCCESS_DURATION_MS = 2000;

/**
 * Editor context menu with copy options
 */
export function EditorContextMenu({
  position,
  editor,
  onDismiss,
}: EditorContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [copyFeedback, setCopyFeedback] = useState<"formatted" | "markdown" | null>(null);

  // Get default copy format from settings
  const defaultCopyFormat = useSettingsStore((s) => s.appearance?.defaultCopyFormat ?? "formatted");
  const updateAppearance = useSettingsStore((s) => s.updateAppearance);

  // Adjust position to keep menu on screen
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 200),
    y: Math.min(position.y, window.innerHeight - 180),
  };

  // Click outside handler
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onDismiss]);

  // Escape key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  // Get selected content or full document
  const getContent = useCallback(() => {
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    if (hasSelection) {
      // Get selected text content
      const plainText = editor.state.doc.textBetween(from, to, "\n");
      // For HTML, we'll use the full document but this is a limitation
      // A proper implementation would serialize just the selection
      // For now, copy selection as plain text only
      const html = `<p>${plainText.replace(/\n/g, "</p><p>")}</p>`;
      return { html, plainText };
    } else {
      // Get full document
      return {
        html: editor.getHTML(),
        plainText: editor.getText(),
      };
    }
  }, [editor]);

  // Handle copy as formatted (rich text)
  const handleCopyFormatted = useCallback(async () => {
    const { html, plainText } = getContent();
    const result = await copyAsFormatted(html, plainText);

    if (result.success) {
      setCopyFeedback("formatted");
      setTimeout(() => {
        setCopyFeedback(null);
        onDismiss();
      }, COPY_SUCCESS_DURATION_MS);
    } else {
      onDismiss();
    }
  }, [getContent, onDismiss]);

  // Handle copy as markdown
  const handleCopyMarkdown = useCallback(async () => {
    const { html } = getContent();
    const result = await copyAsMarkdown(html);

    if (result.success) {
      setCopyFeedback("markdown");
      setTimeout(() => {
        setCopyFeedback(null);
        onDismiss();
      }, COPY_SUCCESS_DURATION_MS);
    } else {
      onDismiss();
    }
  }, [getContent, onDismiss]);

  // Handle set as default
  const handleSetDefaultFormatted = useCallback(() => {
    updateAppearance({ defaultCopyFormat: "formatted" });
  }, [updateAppearance]);

  const handleSetDefaultMarkdown = useCallback(() => {
    updateAppearance({ defaultCopyFormat: "markdown" });
  }, [updateAppearance]);

  const { from, to } = editor.state.selection;
  const hasSelection = from !== to;
  const copyLabel = hasSelection ? "Copy Selection" : "Copy All";

  return (
    <div
      ref={menuRef}
      className="editor-context-menu"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      role="menu"
      aria-label="Editor context menu"
    >
      <button
        className="editor-context-menu-item"
        onClick={handleCopyFormatted}
        role="menuitem"
      >
        <span className="editor-context-menu-icon">
          <FormattedIcon />
        </span>
        <span className="editor-context-menu-label">
          {copyFeedback === "formatted" ? "Copied!" : `${copyLabel} as Formatted`}
        </span>
        {defaultCopyFormat === "formatted" && (
          <span className="editor-context-menu-badge">Default</span>
        )}
      </button>

      <button
        className="editor-context-menu-item"
        onClick={handleCopyMarkdown}
        role="menuitem"
      >
        <span className="editor-context-menu-icon">
          <MarkdownIcon />
        </span>
        <span className="editor-context-menu-label">
          {copyFeedback === "markdown" ? "Copied!" : `${copyLabel} as Markdown`}
        </span>
        {defaultCopyFormat === "markdown" && (
          <span className="editor-context-menu-badge">Default</span>
        )}
      </button>

      <div className="editor-context-menu-divider" />

      <div className="editor-context-menu-section">
        <span className="editor-context-menu-section-title">Set Default</span>
        <button
          className={`editor-context-menu-item editor-context-menu-item-small ${defaultCopyFormat === "formatted" ? "active" : ""}`}
          onClick={handleSetDefaultFormatted}
          role="menuitem"
        >
          <span className="editor-context-menu-icon">
            {defaultCopyFormat === "formatted" ? <CheckIcon /> : null}
          </span>
          <span className="editor-context-menu-label">Formatted (Rich Text)</span>
        </button>
        <button
          className={`editor-context-menu-item editor-context-menu-item-small ${defaultCopyFormat === "markdown" ? "active" : ""}`}
          onClick={handleSetDefaultMarkdown}
          role="menuitem"
        >
          <span className="editor-context-menu-icon">
            {defaultCopyFormat === "markdown" ? <CheckIcon /> : null}
          </span>
          <span className="editor-context-menu-label">Markdown</span>
        </button>
      </div>
    </div>
  );
}

// Icons

function FormattedIcon() {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function MarkdownIcon() {
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
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M7 14h.01M7 18h.01M11 14h6M11 18h6" />
    </svg>
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
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
