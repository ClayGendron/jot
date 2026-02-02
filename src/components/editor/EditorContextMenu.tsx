/**
 * Editor Context Menu Component
 *
 * Provides right-click context menu for the editor with options to copy
 * content in different formats (formatted/rich text or markdown).
 */

import { useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { copyAsFormatted, copyAsMarkdown } from "@/lib/clipboard/copyFormatted";
import { useSettingsStore } from "@/stores/settingsStore";
import { FileText, FileCode, Check } from "lucide-react";
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import {
  PositionedMenu,
  PositionedMenuItem,
  PositionedMenuSeparator,
} from "@/components/ui/positioned-menu";

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
  const menuRef = usePositionedMenu({ onDismiss });
  const [copyFeedback, setCopyFeedback] = useState<"formatted" | "markdown" | null>(null);

  // Get default copy format from settings
  const defaultCopyFormat = useSettingsStore((s) => s.appearance?.defaultCopyFormat ?? "formatted");
  const updateAppearance = useSettingsStore((s) => s.updateAppearance);

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
    <PositionedMenu
      ref={menuRef}
      position={position}
      menuWidth={200}
      menuHeight={180}
      aria-label="Editor context menu"
    >
      <PositionedMenuItem onClick={handleCopyFormatted}>
        <FileText className="h-4 w-4" />
        <span className="flex-1">
          {copyFeedback === "formatted" ? "Copied!" : `${copyLabel} as Formatted`}
        </span>
        {defaultCopyFormat === "formatted" && (
          <span className="text-xs text-muted-foreground">Default</span>
        )}
      </PositionedMenuItem>

      <PositionedMenuItem onClick={handleCopyMarkdown}>
        <FileCode className="h-4 w-4" />
        <span className="flex-1">
          {copyFeedback === "markdown" ? "Copied!" : `${copyLabel} as Markdown`}
        </span>
        {defaultCopyFormat === "markdown" && (
          <span className="text-xs text-muted-foreground">Default</span>
        )}
      </PositionedMenuItem>

      <PositionedMenuSeparator />

      <div className="px-2 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">Set Default</span>
      </div>

      <PositionedMenuItem onClick={handleSetDefaultFormatted}>
        <span className="w-4 flex items-center justify-center">
          {defaultCopyFormat === "formatted" && <Check className="h-3.5 w-3.5" />}
        </span>
        <span>Formatted (Rich Text)</span>
      </PositionedMenuItem>

      <PositionedMenuItem onClick={handleSetDefaultMarkdown}>
        <span className="w-4 flex items-center justify-center">
          {defaultCopyFormat === "markdown" && <Check className="h-3.5 w-3.5" />}
        </span>
        <span>Markdown</span>
      </PositionedMenuItem>
    </PositionedMenu>
  );
}
