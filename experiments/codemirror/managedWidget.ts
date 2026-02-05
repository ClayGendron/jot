/**
 * ManagedWidget Abstraction for CodeMirror
 *
 * Provides utilities for widgets that need to handle events with fresh data.
 * Solves the stale closure problem where widget event handlers close over
 * `this.tableFrom` at creation time, but the document changes.
 *
 * Core pattern: Read anchor from DOM, re-parse data, pass fresh context to handler.
 */

import type { EditorView } from "@codemirror/view";

// ===========================================
// TYPES
// ===========================================

/**
 * Configuration for a managed widget type.
 * Defines how to identify the widget in DOM and how to re-parse its data.
 *
 * @template TData The data type returned by reparse (e.g., TableInfo)
 */
export interface ManagedWidgetConfig<TData> {
  /** Stored as data-widget-key on the wrapper element */
  widgetKey: string;
  /** Attribute name (without 'data-' prefix) for the anchor position, e.g., "table-from" */
  anchorAttr: string;
  /** Re-parses data from current editor state using the anchor position */
  reparse: (view: EditorView, anchorValue: number) => TData | null;
}

/**
 * Context passed to managed event handlers.
 * Contains fresh data re-parsed from the current editor state.
 *
 * @template TData The data type (e.g., TableInfo)
 */
export interface ManagedEventContext<TData> {
  /** Fresh data from reparse() - guaranteed not stale */
  data: TData;
  /** Position read from DOM (the anchor value) */
  anchorValue: number;
  /** The EditorView instance */
  view: EditorView;
  /** The widget's root element */
  widgetRoot: HTMLElement;
}

/**
 * Focus state captured before DOM updates.
 * Used by captureFocus/restoreFocus for focus preservation.
 */
export interface FocusState {
  /** Whether any element inside the widget had focus */
  hadFocus: boolean;
  /** CSS selector path to the focused element, or null if none */
  focusPath: string | null;
  /** Selection start offset within the focused element */
  selectionStart: number;
  /** Selection end offset within the focused element */
  selectionEnd: number;
}

// ===========================================
// CORE UTILITIES
// ===========================================

/**
 * Read anchor position from DOM element's data attribute.
 *
 * @param element - Any element inside or the widget root
 * @param anchorAttr - Attribute name without 'data-' prefix (e.g., "table-from")
 * @returns The anchor position, or null if not found
 *
 * @example
 * const tableFrom = readAnchorFromDOM(cell, "table-from");
 * // Finds closest [data-table-from] and parses the value
 */
export function readAnchorFromDOM(
  element: HTMLElement,
  anchorAttr: string
): number | null {
  // Find the closest element with the data attribute
  const selector = `[data-${anchorAttr}]`;
  const wrapper = element.closest(selector) as HTMLElement | null;

  if (!wrapper) return null;

  const valueStr = wrapper.dataset[toCamelCase(anchorAttr)];
  if (valueStr === undefined || valueStr === null) return null;

  const value = parseInt(valueStr, 10);
  return Number.isNaN(value) ? null : value;
}

/**
 * Convert kebab-case to camelCase for dataset access.
 * "table-from" -> "tableFrom"
 */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Create a managed event handler that automatically:
 * 1. Reads anchor from DOM (not stale `this.*`)
 * 2. Re-parses data from current editor state
 * 3. Passes fresh context to handler
 * 4. Skips handler if data is null (widget deleted)
 *
 * @template TData The data type (e.g., TableInfo)
 * @template E The event type (e.g., MouseEvent, KeyboardEvent)
 *
 * @param config - Widget configuration with reparse function
 * @param view - The EditorView instance
 * @param handler - The actual handler receiving fresh context
 * @returns A wrapped event handler safe to attach to DOM elements
 *
 * @example
 * const handleClick = createManagedHandler(
 *   TABLE_CONFIG,
 *   view,
 *   (event, { data: tableInfo }) => {
 *     // tableInfo is guaranteed fresh!
 *     addTableRow(view, tableInfo);
 *   }
 * );
 * button.addEventListener("click", handleClick);
 */
export function createManagedHandler<TData, E extends Event>(
  config: ManagedWidgetConfig<TData>,
  view: EditorView,
  handler: (event: E, context: ManagedEventContext<TData>) => void
): (event: E) => void {
  return (event: E) => {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return;

    // Read anchor from DOM - this stays current even when widget instance is stale
    const anchorValue = readAnchorFromDOM(target, config.anchorAttr);
    if (anchorValue === null) return;

    // Re-parse data from current state
    const data = config.reparse(view, anchorValue);
    if (data === null) return; // Widget was deleted

    // Find widget root
    const selector = `[data-${config.anchorAttr}]`;
    const widgetRoot = target.closest(selector) as HTMLElement;
    if (!widgetRoot) return;

    // Call handler with fresh context
    handler(event, {
      data,
      anchorValue,
      view,
      widgetRoot,
    });
  };
}

// ===========================================
// FOCUS MANAGEMENT
// ===========================================

/**
 * Capture focus state before DOM updates.
 * Call this at the start of updateDOM() before any changes.
 *
 * @param widgetRoot - The widget's root element
 * @returns FocusState that can be passed to restoreFocus()
 *
 * @example
 * updateDOM(dom, view) {
 *   const focusState = captureFocus(dom);
 *   // ... make DOM changes ...
 *   restoreFocus(dom, focusState);
 * }
 */
export function captureFocus(widgetRoot: HTMLElement): FocusState {
  const doc = widgetRoot.ownerDocument;
  const activeEl = doc.activeElement;

  if (!activeEl || !widgetRoot.contains(activeEl)) {
    return {
      hadFocus: false,
      focusPath: null,
      selectionStart: 0,
      selectionEnd: 0,
    };
  }

  // Build a selector path to the focused element
  const focusPath = buildFocusPath(activeEl as HTMLElement, widgetRoot);

  // Capture selection/cursor position
  let selectionStart = 0;
  let selectionEnd = 0;
  const sel = doc.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    selectionStart = range.startOffset;
    selectionEnd = range.endOffset;
  }

  return {
    hadFocus: true,
    focusPath,
    selectionStart,
    selectionEnd,
  };
}

/**
 * Restore focus after DOM updates.
 * Call this at the end of updateDOM() after all changes.
 *
 * @param widgetRoot - The widget's root element (may be new DOM)
 * @param state - FocusState from captureFocus()
 */
export function restoreFocus(widgetRoot: HTMLElement, state: FocusState): void {
  if (!state.hadFocus || !state.focusPath) return;

  const doc = widgetRoot.ownerDocument;
  const targetEl = widgetRoot.querySelector(state.focusPath) as HTMLElement | null;

  if (!targetEl) return;

  targetEl.focus();

  // Restore cursor position if there's a text node
  const sel = doc.getSelection();
  if (sel && targetEl.firstChild) {
    try {
      const range = doc.createRange();
      const textNode = targetEl.firstChild;
      const maxOffset = textNode.textContent?.length ?? 0;
      range.setStart(textNode, Math.min(state.selectionStart, maxOffset));
      range.setEnd(textNode, Math.min(state.selectionEnd, maxOffset));
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      // Fallback: just focus the element
    }
  }
}

/**
 * Build a CSS selector path to an element within a widget.
 * Uses data attributes preferentially for stability.
 */
function buildFocusPath(element: HTMLElement, root: HTMLElement): string | null {
  // If element has data-row and data-col, use those (table cells)
  if (element.dataset.row !== undefined && element.dataset.col !== undefined) {
    return `[data-row="${element.dataset.row}"][data-col="${element.dataset.col}"]`;
  }

  // Fallback: use tag name and index
  const parent = element.parentElement;
  if (!parent || !root.contains(parent)) return null;

  const siblings = Array.from(parent.children).filter(
    (el) => el.tagName === element.tagName
  );
  const index = siblings.indexOf(element);

  if (parent === root) {
    return `${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
  }

  const parentPath = buildFocusPath(parent, root);
  if (!parentPath) return null;

  return `${parentPath} > ${element.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
}

// ===========================================
// EVENT MANAGER
// ===========================================

interface AttachedHandler {
  element: HTMLElement;
  eventType: string;
  handler: EventListener;
}

/**
 * Manages event handler lifecycle for widget elements.
 * Automatically cleans up handlers when detach/detachAll is called.
 *
 * @example
 * class MyWidget extends WidgetType {
 *   private eventManager = new WidgetEventManager();
 *
 *   toDOM(view) {
 *     const btn = document.createElement("button");
 *     this.eventManager.attach(btn, "click", CONFIG, view, (e, ctx) => {
 *       // Handle with fresh context
 *     });
 *     return btn;
 *   }
 *
 *   destroy() {
 *     this.eventManager.detachAll();
 *   }
 * }
 */
export class WidgetEventManager {
  private handlers: AttachedHandler[] = [];

  /**
   * Attach a managed event handler to an element.
   *
   * @template TData The data type
   * @template E The event type
   *
   * @param element - DOM element to attach to
   * @param eventType - Event type (e.g., "click", "input", "keydown")
   * @param config - Widget configuration
   * @param view - EditorView instance
   * @param handler - Handler receiving fresh context
   */
  attach<TData, E extends Event>(
    element: HTMLElement,
    eventType: string,
    config: ManagedWidgetConfig<TData>,
    view: EditorView,
    handler: (event: E, context: ManagedEventContext<TData>) => void
  ): void {
    const wrappedHandler = createManagedHandler(config, view, handler) as EventListener;
    element.addEventListener(eventType, wrappedHandler);
    this.handlers.push({ element, eventType, handler: wrappedHandler });
  }

  /**
   * Attach a raw (non-managed) event handler.
   * Use for handlers that don't need fresh data context.
   *
   * @param element - DOM element to attach to
   * @param eventType - Event type
   * @param handler - Raw event handler
   */
  attachRaw(
    element: HTMLElement,
    eventType: string,
    handler: EventListener
  ): void {
    element.addEventListener(eventType, handler);
    this.handlers.push({ element, eventType, handler });
  }

  /**
   * Detach all handlers from a specific element.
   *
   * @param element - Element to detach handlers from
   */
  detach(element: HTMLElement): void {
    const toRemove: AttachedHandler[] = [];

    for (const h of this.handlers) {
      if (h.element === element) {
        h.element.removeEventListener(h.eventType, h.handler);
        toRemove.push(h);
      }
    }

    this.handlers = this.handlers.filter((h) => !toRemove.includes(h));
  }

  /**
   * Detach all handlers managed by this instance.
   * Call in widget's destroy() method.
   */
  detachAll(): void {
    for (const h of this.handlers) {
      h.element.removeEventListener(h.eventType, h.handler);
    }
    this.handlers = [];
  }
}
