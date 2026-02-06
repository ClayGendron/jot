/**
 * Link Handlers
 *
 * Link editing functionality:
 * - Cmd+K to create/edit links
 * - Link context detection
 * - Link editor state management
 * - Context menu actions
 */

import type { EditorView } from "@codemirror/view";
import type { EditorState } from "@codemirror/state";
import { findLinkByRegex, type LinkContext } from "../utils/sharedHelpers";

// ===========================================
// LINK CONTEXT DETECTION
// ===========================================

/**
 * Get the link context at the current cursor position
 */
export function getLinkContext(state: EditorState): LinkContext | null {
  const pos = state.selection.main.head;
  return findLinkByRegex(state, (from, to) => pos >= from && pos <= to);
}

/**
 * Get link context at a specific document position
 */
export function getLinkContextAtPos(state: EditorState, pos: number): LinkContext | null {
  return findLinkByRegex(state, (from, to) => pos >= from && pos <= to);
}

// ===========================================
// LINK EDITOR STATE
// ===========================================

/**
 * State for the link editor popup
 */
export interface LinkEditorState {
  isOpen: boolean;
  linkContext: LinkContext | null;
  view: EditorView | null;
  mode: "edit" | "create";
  selectedText?: string;
}

let linkEditorState: LinkEditorState = {
  isOpen: false,
  linkContext: null,
  view: null,
  mode: "create",
};

/**
 * Callbacks for when link editor state changes
 */
type LinkEditorCallback = (state: LinkEditorState) => void;
const linkEditorCallbacks: LinkEditorCallback[] = [];

export function subscribeLinkEditor(callback: LinkEditorCallback) {
  linkEditorCallbacks.push(callback);
  return () => {
    const index = linkEditorCallbacks.indexOf(callback);
    if (index > -1) linkEditorCallbacks.splice(index, 1);
  };
}

function notifyLinkEditorChange() {
  linkEditorCallbacks.forEach(cb => cb(linkEditorState));
}

/**
 * Get current link editor state
 */
export function getLinkEditorState(): LinkEditorState {
  return linkEditorState;
}

/**
 * Open the link editor popup
 */
export function openLinkEditor(view: EditorView, ctx: LinkContext | null, mode: "edit" | "create", selectedText?: string) {
  linkEditorState = {
    isOpen: true,
    linkContext: ctx,
    view,
    mode,
    selectedText,
  };
  notifyLinkEditorChange();
}

/**
 * Close the link editor popup
 */
export function closeLinkEditor() {
  linkEditorState = {
    isOpen: false,
    linkContext: null,
    view: null,
    mode: "create",
  };
  notifyLinkEditorChange();
}

/**
 * Apply link from the editor
 */
export function applyLink(url: string) {
  const { view, linkContext, mode, selectedText } = linkEditorState;
  if (!view) return;

  if (mode === "edit" && linkContext) {
    // Edit existing link URL
    view.dispatch({
      changes: { from: linkContext.urlFrom, to: linkContext.urlTo, insert: url },
      selection: { anchor: linkContext.textTo },
      scrollIntoView: true,
    });
  } else if (mode === "create" && selectedText) {
    // Wrap selection in link
    const sel = view.state.selection.main;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: `[${selectedText}](${url})` },
      selection: { anchor: sel.from + selectedText.length + 3 + url.length + 1 },
      scrollIntoView: true,
    });
  } else {
    // Create new empty link at cursor
    const pos = view.state.selection.main.head;
    view.dispatch({
      changes: { from: pos, to: pos, insert: `[](${url})` },
      selection: { anchor: pos + 1 }, // Inside the []
      scrollIntoView: true,
    });
  }

  closeLinkEditor();
  view.focus();
}

/**
 * Remove link (keep text)
 */
export function removeLink() {
  const { view, linkContext } = linkEditorState;
  if (!view || !linkContext) return;

  view.dispatch({
    changes: { from: linkContext.from, to: linkContext.to, insert: linkContext.text },
    selection: { anchor: linkContext.from + linkContext.text.length },
    scrollIntoView: true,
  });

  closeLinkEditor();
  view.focus();
}

// ===========================================
// LINK CONTEXT MENU STATE
// ===========================================

/**
 * State for the link context menu
 */
export interface LinkContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  linkContext: LinkContext | null;
  view: EditorView | null;
}

let linkContextMenuState: LinkContextMenuState = {
  isOpen: false,
  x: 0,
  y: 0,
  linkContext: null,
  view: null,
};

/**
 * Callbacks for when context menu state changes
 */
type LinkContextMenuCallback = (state: LinkContextMenuState) => void;
const linkContextMenuCallbacks: LinkContextMenuCallback[] = [];

export function subscribeLinkContextMenu(callback: LinkContextMenuCallback) {
  linkContextMenuCallbacks.push(callback);
  return () => {
    const index = linkContextMenuCallbacks.indexOf(callback);
    if (index > -1) linkContextMenuCallbacks.splice(index, 1);
  };
}

function notifyLinkContextMenuChange() {
  linkContextMenuCallbacks.forEach(cb => cb(linkContextMenuState));
}

/**
 * Get current link context menu state
 */
export function getLinkContextMenuState(): LinkContextMenuState {
  return linkContextMenuState;
}

/**
 * Open the link context menu
 */
export function openLinkContextMenu(x: number, y: number, linkContext: LinkContext, view: EditorView) {
  linkContextMenuState = {
    isOpen: true,
    x,
    y,
    linkContext,
    view,
  };
  notifyLinkContextMenuChange();
}

/**
 * Close the link context menu
 */
export function closeLinkContextMenu() {
  linkContextMenuState = {
    isOpen: false,
    x: 0,
    y: 0,
    linkContext: null,
    view: null,
  };
  notifyLinkContextMenuChange();
}

/**
 * Handle "Edit Link" from context menu
 */
export function handleContextMenuEditLink() {
  const { view, linkContext } = linkContextMenuState;
  if (!view || !linkContext) return;

  closeLinkContextMenu();
  openLinkEditor(view, linkContext, "edit");
}

/**
 * Handle "Remove Link" from context menu
 */
export function handleContextMenuRemoveLink() {
  const { view, linkContext } = linkContextMenuState;
  if (!view || !linkContext) return;

  view.dispatch({
    changes: { from: linkContext.from, to: linkContext.to, insert: linkContext.text },
    selection: { anchor: linkContext.from + linkContext.text.length },
    scrollIntoView: true,
  });

  closeLinkContextMenu();
  view.focus();
}

/**
 * Handle "Copy Link URL" from context menu
 */
export function handleContextMenuCopyLink() {
  const { view, linkContext } = linkContextMenuState;
  if (!view || !linkContext) return;

  navigator.clipboard.writeText(linkContext.url).catch(() => {
    // Silently fail if clipboard access is denied
  });

  closeLinkContextMenu();
  view.focus();
}

/**
 * Handle "Open Link" from context menu
 */
export function handleContextMenuOpenLink() {
  const { view, linkContext } = linkContextMenuState;
  if (!view || !linkContext) return;

  if (linkContext.url) {
    window.open(linkContext.url, "_blank", "noopener,noreferrer");
  }

  closeLinkContextMenu();
  view.focus();
}

// ===========================================
// KEYBOARD COMMAND
// ===========================================

/**
 * Handle Cmd+K command for links
 * - On existing link: open editor to edit URL
 * - With selection: wrap selection in link
 * - Empty cursor: create new link at cursor
 */
export function handleLinkCommand(view: EditorView): boolean {
  const ctx = getLinkContext(view.state);
  const sel = view.state.selection.main;

  if (ctx) {
    // Cursor is inside a link - edit it
    openLinkEditor(view, ctx, "edit");
    return true;
  }

  if (!sel.empty) {
    // Has selection - wrap in link
    const selectedText = view.state.doc.sliceString(sel.from, sel.to);
    openLinkEditor(view, null, "create", selectedText);
    return true;
  }

  // Empty cursor - create new empty link
  view.dispatch({
    changes: { from: sel.head, to: sel.head, insert: "[]()" },
    selection: { anchor: sel.head + 1 },
    scrollIntoView: true,
  });
  return true;
}
