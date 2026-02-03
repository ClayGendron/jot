/**
 * Editor Context Menu Component
 *
 * Provides right-click context menu for the editor with options to copy
 * content in different formats (formatted/rich text or markdown).
 *
 * Phase 8: Updated to support both TipTap and CodeMirror 6 editors.
 * For CM6, copies use markdownToHtml for formatted output (not editor DOM).
 */

import { useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { EditorView } from "@codemirror/view";
import { copyAsFormatted, copyAsMarkdown } from "@/lib/clipboard/copyFormatted";
import { markdownToHtml } from "@/lib/markdown/markdownToHtml";
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
  /** TipTap editor instance (for legacy HTML-based editing) */
  editor?: Editor | null;
  /** CodeMirror view instance (for markdown-based editing) */
  cmView?: EditorView | null;
  /** Callback when menu should be dismissed */
  onDismiss: () => void;
}

const COPY_SUCCESS_DURATION_MS = 2000;

/**
 * Editor context menu with copy options
 * Supports both TipTap (HTML) and CodeMirror 6 (Markdown) editors.
 */
export function EditorContextMenu({
  position,
  editor,
  cmView,
  onDismiss,
}: EditorContextMenuProps) {
  const menuRef = usePositionedMenu({ onDismiss });
  const [copyFeedback, setCopyFeedback] = useState<"formatted" | "markdown" | null>(null);

  // Get default copy format from settings
  const defaultCopyFormat = useSettingsStore((s) => s.appearance?.defaultCopyFormat ?? "formatted");
  const updateAppearance = useSettingsStore((s) => s.updateAppearance);

  // Determine which editor is active
  const isCM = !!cmView;
  const hasEditor = !!editor || !!cmView;

  // Get selected content or full document
  const getContent = useCallback((): { html: string; markdown: string; plainText: string } => {
    if (cmView) {
      // CodeMirror 6: Content is markdown
      const { from, to } = cmView.state.selection.main;
      const hasSelection = from !== to;

      if (hasSelection) {
        // Get selected markdown
        const markdown = cmView.state.doc.sliceString(from, to);
        const html = markdownToHtml(markdown);
        return { html, markdown, plainText: markdown };
      } else {
        // Get full document
        const markdown = cmView.state.doc.toString();
        const html = markdownToHtml(markdown);
        return { html, markdown, plainText: markdown };
      }
    } else if (editor) {
      // TipTap: Content is HTML
      const { from, to } = editor.state.selection;
      const hasSelection = from !== to;

      if (hasSelection) {
        // Get selected text content
        const plainText = editor.state.doc.textBetween(from, to, "\n");
        // For HTML, we create a simple paragraph-based representation
        const html = `<p>${plainText.replace(/\n/g, "</p><p>")}</p>`;
        // For markdown, we use the plain text (TipTap selection doesn't preserve markdown)
        return { html, markdown: plainText, plainText };
      } else {
        // Get full document
        return {
          html: editor.getHTML(),
          markdown: editor.getText(),
          plainText: editor.getText(),
        };
      }
    }

    return { html: "", markdown: "", plainText: "" };
  }, [editor, cmView]);

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
    if (isCM) {
      // For CM6: Copy markdown directly
      const { markdown } = getContent();
      try {
        await navigator.clipboard.writeText(markdown);
        setCopyFeedback("markdown");
        setTimeout(() => {
          setCopyFeedback(null);
          onDismiss();
        }, COPY_SUCCESS_DURATION_MS);
      } catch {
        onDismiss();
      }
    } else {
      // For TipTap: Convert HTML to markdown
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
    }
  }, [getContent, onDismiss, isCM]);

  // Handle set as default
  const handleSetDefaultFormatted = useCallback(() => {
    updateAppearance({ defaultCopyFormat: "formatted" });
  }, [updateAppearance]);

  const handleSetDefaultMarkdown = useCallback(() => {
    updateAppearance({ defaultCopyFormat: "markdown" });
  }, [updateAppearance]);

  // Determine if there's a selection
  const hasSelection = cmView
    ? cmView.state.selection.main.from !== cmView.state.selection.main.to
    : editor
      ? editor.state.selection.from !== editor.state.selection.to
      : false;

  const copyLabel = hasSelection ? "Copy Selection" : "Copy All";

  if (!hasEditor) {
    return null;
  }

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
