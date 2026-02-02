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
import { FileText, FileCode, Check } from "lucide-react";

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
          <FileText className="h-4 w-4" />
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
          <FileCode className="h-4 w-4" />
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
            {defaultCopyFormat === "formatted" ? <Check className="h-3.5 w-3.5" /> : null}
          </span>
          <span className="editor-context-menu-label">Formatted (Rich Text)</span>
        </button>
        <button
          className={`editor-context-menu-item editor-context-menu-item-small ${defaultCopyFormat === "markdown" ? "active" : ""}`}
          onClick={handleSetDefaultMarkdown}
          role="menuitem"
        >
          <span className="editor-context-menu-icon">
            {defaultCopyFormat === "markdown" ? <Check className="h-3.5 w-3.5" /> : null}
          </span>
          <span className="editor-context-menu-label">Markdown</span>
        </button>
      </div>
    </div>
  );
}
