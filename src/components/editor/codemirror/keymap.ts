/**
 * CodeMirror 6 Keymap for Jot
 *
 * Custom keyboard shortcuts for markdown editing.
 * Phase 2: Formatting commands for bold, italic, strikethrough, code, highlight.
 */

import type { KeyBinding } from "@codemirror/view";
import {
  toggleBold,
  toggleItalic,
  toggleStrikethrough,
  toggleInlineCode,
  toggleHighlight,
} from "./commands/formatting";

/**
 * Jot-specific keyboard shortcuts
 *
 * Includes formatting shortcuts that match common word processor conventions
 * and additional markdown-specific shortcuts.
 */
export const jotKeymap: KeyBinding[] = [
  // Bold: Cmd/Ctrl+B
  {
    key: "Mod-b",
    run: toggleBold,
  },
  // Italic: Cmd/Ctrl+I
  {
    key: "Mod-i",
    run: toggleItalic,
  },
  // Strikethrough: Cmd/Ctrl+Shift+S
  {
    key: "Mod-Shift-s",
    run: toggleStrikethrough,
  },
  // Inline code: Cmd/Ctrl+E (same as VS Code)
  {
    key: "Mod-e",
    run: toggleInlineCode,
  },
  // Highlight: Cmd/Ctrl+Shift+H
  {
    key: "Mod-Shift-h",
    run: toggleHighlight,
  },
];
