/**
 * CodeMirror 6 Basic Setup
 *
 * Creates a minimal CM6 configuration for editing Markdown.
 * Markdown is the canonical format - no conversion on load/save.
 */

import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine, drawSelection, dropCursor } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { bracketMatching } from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import { jotKeymap } from "./keymap";
import { jotTheme } from "./theme";

/**
 * Create the base extensions for the Jot CodeMirror editor
 */
export function createBaseExtensions(): Extension[] {
  return [
    // Markdown language with GFM (GitHub Flavored Markdown)
    markdown({ extensions: [GFM] }),

    // Core editing features
    history(),
    drawSelection(),
    dropCursor(),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightSelectionMatches(),

    // Keymaps
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      ...jotKeymap,
    ]),

    // Theme
    jotTheme,
  ];
}

/**
 * Create extensions with optional line numbers
 */
export function createExtensions(options: { showLineNumbers?: boolean } = {}): Extension[] {
  const extensions = createBaseExtensions();

  if (options.showLineNumbers) {
    extensions.push(lineNumbers());
  }

  return extensions;
}

/**
 * Create a new CodeMirror editor state
 */
export function createEditorState(
  doc: string,
  extensions: Extension[] = createExtensions()
): EditorState {
  return EditorState.create({
    doc,
    extensions,
  });
}

/**
 * Create a new CodeMirror editor view
 */
export function createEditorView(
  state: EditorState,
  parent: HTMLElement
): EditorView {
  return new EditorView({
    state,
    parent,
  });
}
