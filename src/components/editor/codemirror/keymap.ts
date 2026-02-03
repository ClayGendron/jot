/**
 * CodeMirror 6 Keymap for Jot
 *
 * Custom keyboard shortcuts for markdown editing.
 * Phase 1: Basic shortcuts only. Formatting commands added in Phase 2.
 */

import type { KeyBinding } from "@codemirror/view";

/**
 * Jot-specific keyboard shortcuts
 *
 * Phase 1: Placeholder bindings - actual formatting commands will be added in Phase 2
 * when we implement delimiter-preserving formatting.
 */
export const jotKeymap: KeyBinding[] = [
  // Formatting shortcuts (Phase 2 will implement actual handlers)
  // For now, these are placeholders that do nothing
  // {
  //   key: "Mod-b",
  //   run: toggleBold, // Phase 2
  // },
  // {
  //   key: "Mod-i",
  //   run: toggleItalic, // Phase 2
  // },
];
