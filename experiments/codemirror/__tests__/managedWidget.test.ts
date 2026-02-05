/**
 * Unit tests for ManagedWidget abstraction
 *
 * Tests the core utilities for managed widgets:
 * - readAnchorFromDOM
 * - createManagedHandler
 * - captureFocus / restoreFocus
 * - WidgetEventManager
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EditorView } from "@codemirror/view";
import {
  readAnchorFromDOM,
  createManagedHandler,
  captureFocus,
  restoreFocus,
  WidgetEventManager,
  type ManagedWidgetConfig,
  type FocusState,
} from "../managedWidget";

// ===========================================
// TEST FIXTURES
// ===========================================

interface MockData {
  id: string;
  value: number;
}

const MOCK_CONFIG: ManagedWidgetConfig<MockData> = {
  widgetKey: "test-widget",
  anchorAttr: "widget-from",
  reparse: vi.fn((_view: EditorView, anchorValue: number) => ({
    id: `data-${anchorValue}`,
    value: anchorValue * 2,
  })),
};

function createMockView(): EditorView {
  return {} as EditorView;
}

// ===========================================
// readAnchorFromDOM TESTS
// ===========================================

describe("readAnchorFromDOM", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("returns null when element has no matching ancestor", () => {
    container.innerHTML = `<div><span id="target">text</span></div>`;
    const target = container.querySelector("#target") as HTMLElement;

    const result = readAnchorFromDOM(target, "widget-from");
    expect(result).toBeNull();
  });

  it("reads anchor from direct element", () => {
    container.innerHTML = `<div data-widget-from="42" id="target">text</div>`;
    const target = container.querySelector("#target") as HTMLElement;

    const result = readAnchorFromDOM(target, "widget-from");
    expect(result).toBe(42);
  });

  it("reads anchor from ancestor element", () => {
    container.innerHTML = `
      <div data-widget-from="100">
        <table>
          <tr>
            <td id="target">cell</td>
          </tr>
        </table>
      </div>
    `;
    const target = container.querySelector("#target") as HTMLElement;

    const result = readAnchorFromDOM(target, "widget-from");
    expect(result).toBe(100);
  });

  it("finds closest ancestor when multiple match", () => {
    container.innerHTML = `
      <div data-widget-from="50">
        <div data-widget-from="75">
          <span id="target">text</span>
        </div>
      </div>
    `;
    const target = container.querySelector("#target") as HTMLElement;

    const result = readAnchorFromDOM(target, "widget-from");
    expect(result).toBe(75); // Closest wins
  });

  it("handles kebab-case attribute names", () => {
    container.innerHTML = `<div data-table-from="123" id="target">text</div>`;
    const target = container.querySelector("#target") as HTMLElement;

    const result = readAnchorFromDOM(target, "table-from");
    expect(result).toBe(123);
  });

  it("returns null for non-numeric values", () => {
    container.innerHTML = `<div data-widget-from="not-a-number" id="target">text</div>`;
    const target = container.querySelector("#target") as HTMLElement;

    const result = readAnchorFromDOM(target, "widget-from");
    expect(result).toBeNull();
  });

  it("returns null for empty string value", () => {
    container.innerHTML = `<div data-widget-from="" id="target">text</div>`;
    const target = container.querySelector("#target") as HTMLElement;

    const result = readAnchorFromDOM(target, "widget-from");
    expect(result).toBeNull();
  });

  it("handles negative numbers", () => {
    container.innerHTML = `<div data-widget-from="-10" id="target">text</div>`;
    const target = container.querySelector("#target") as HTMLElement;

    const result = readAnchorFromDOM(target, "widget-from");
    expect(result).toBe(-10);
  });

  it("handles zero", () => {
    container.innerHTML = `<div data-widget-from="0" id="target">text</div>`;
    const target = container.querySelector("#target") as HTMLElement;

    const result = readAnchorFromDOM(target, "widget-from");
    expect(result).toBe(0);
  });
});

// ===========================================
// createManagedHandler TESTS
// ===========================================

describe("createManagedHandler", () => {
  let container: HTMLDivElement;
  let mockView: EditorView;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    mockView = createMockView();
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
  });

  it("calls handler with fresh data context", () => {
    container.innerHTML = `
      <div data-widget-from="42">
        <button id="btn">Click me</button>
      </div>
    `;
    const btn = container.querySelector("#btn") as HTMLElement;
    const handler = vi.fn();

    const wrappedHandler = createManagedHandler(MOCK_CONFIG, mockView, handler);
    btn.addEventListener("click", wrappedHandler);

    btn.click();

    expect(handler).toHaveBeenCalledOnce();
    const [event, context] = handler.mock.calls[0];
    expect(event).toBeInstanceOf(MouseEvent);
    expect(context.anchorValue).toBe(42);
    expect(context.data.id).toBe("data-42");
    expect(context.data.value).toBe(84);
    expect(context.view).toBe(mockView);
    expect(context.widgetRoot).toBe(container.querySelector("[data-widget-from]"));
  });

  it("reads anchor fresh on each event (not stale)", () => {
    container.innerHTML = `
      <div data-widget-from="10">
        <button id="btn">Click me</button>
      </div>
    `;
    const btn = container.querySelector("#btn") as HTMLElement;
    const wrapper = container.querySelector("[data-widget-from]") as HTMLElement;
    const handler = vi.fn();

    const wrappedHandler = createManagedHandler(MOCK_CONFIG, mockView, handler);
    btn.addEventListener("click", wrappedHandler);

    // First click
    btn.click();
    expect(handler.mock.calls[0][1].anchorValue).toBe(10);

    // Simulate document change by updating the data attribute
    wrapper.dataset.widgetFrom = "99";

    // Second click should see new value
    btn.click();
    expect(handler.mock.calls[1][1].anchorValue).toBe(99);
  });

  it("skips handler when anchor not found", () => {
    container.innerHTML = `<button id="btn">No anchor</button>`;
    const btn = container.querySelector("#btn") as HTMLElement;
    const handler = vi.fn();

    const wrappedHandler = createManagedHandler(MOCK_CONFIG, mockView, handler);
    btn.addEventListener("click", wrappedHandler);

    btn.click();

    expect(handler).not.toHaveBeenCalled();
  });

  it("skips handler when reparse returns null", () => {
    const nullConfig: ManagedWidgetConfig<MockData> = {
      ...MOCK_CONFIG,
      reparse: () => null,
    };

    container.innerHTML = `
      <div data-widget-from="42">
        <button id="btn">Click me</button>
      </div>
    `;
    const btn = container.querySelector("#btn") as HTMLElement;
    const handler = vi.fn();

    const wrappedHandler = createManagedHandler(nullConfig, mockView, handler);
    btn.addEventListener("click", wrappedHandler);

    btn.click();

    expect(handler).not.toHaveBeenCalled();
  });

  it("works with different event types", () => {
    container.innerHTML = `
      <div data-widget-from="5">
        <input id="input" type="text" />
      </div>
    `;
    const input = container.querySelector("#input") as HTMLInputElement;
    const handler = vi.fn();

    const wrappedHandler = createManagedHandler(MOCK_CONFIG, mockView, handler);
    input.addEventListener("input", wrappedHandler);

    const inputEvent = new InputEvent("input", { bubbles: true });
    input.dispatchEvent(inputEvent);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][1].anchorValue).toBe(5);
  });

  it("handles event with no currentTarget gracefully", () => {
    const handler = vi.fn();
    const wrappedHandler = createManagedHandler(MOCK_CONFIG, mockView, handler);

    // Create a synthetic event without proper target
    const event = new Event("custom");
    // Force currentTarget to be null
    Object.defineProperty(event, "currentTarget", { value: null });

    wrappedHandler(event);

    expect(handler).not.toHaveBeenCalled();
  });
});

// ===========================================
// captureFocus / restoreFocus TESTS
// ===========================================

describe("captureFocus", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("returns hadFocus: false when nothing focused", () => {
    container.innerHTML = `<div><input type="text" /></div>`;

    const state = captureFocus(container);

    expect(state.hadFocus).toBe(false);
    expect(state.focusPath).toBeNull();
  });

  it("returns hadFocus: false when focus is outside widget", () => {
    container.innerHTML = `<div id="widget"><input id="inside" /></div>`;
    const outside = document.createElement("input");
    document.body.appendChild(outside);
    outside.focus();

    const widget = container.querySelector("#widget") as HTMLElement;
    const state = captureFocus(widget);

    expect(state.hadFocus).toBe(false);
    outside.remove();
  });

  it("captures focus state with data attributes", () => {
    container.innerHTML = `
      <div id="widget">
        <div data-row="1" data-col="2" tabindex="0" id="cell">cell</div>
      </div>
    `;
    const widget = container.querySelector("#widget") as HTMLElement;
    const cell = container.querySelector("#cell") as HTMLElement;
    cell.focus();

    const state = captureFocus(widget);

    expect(state.hadFocus).toBe(true);
    expect(state.focusPath).toBe('[data-row="1"][data-col="2"]');
  });

  it("captures selection offsets from focused element", () => {
    container.innerHTML = `
      <div id="widget">
        <div contenteditable data-row="0" data-col="0" id="cell">Hello World</div>
      </div>
    `;
    const widget = container.querySelector("#widget") as HTMLElement;
    const cell = container.querySelector("#cell") as HTMLElement;
    cell.focus();

    // Set a selection
    const range = document.createRange();
    range.setStart(cell.firstChild!, 3);
    range.setEnd(cell.firstChild!, 8);
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);

    const state = captureFocus(widget);

    expect(state.hadFocus).toBe(true);
    expect(state.selectionStart).toBe(3);
    expect(state.selectionEnd).toBe(8);
  });
});

describe("restoreFocus", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("does nothing when hadFocus is false", () => {
    container.innerHTML = `<div id="widget"><input id="input" /></div>`;
    const widget = container.querySelector("#widget") as HTMLElement;
    const input = container.querySelector("#input") as HTMLInputElement;

    const state: FocusState = {
      hadFocus: false,
      focusPath: null,
      selectionStart: 0,
      selectionEnd: 0,
    };

    restoreFocus(widget, state);

    expect(document.activeElement).not.toBe(input);
  });

  it("restores focus to element by path", () => {
    container.innerHTML = `
      <div id="widget">
        <div data-row="1" data-col="2" tabindex="0" id="cell">cell</div>
      </div>
    `;
    const widget = container.querySelector("#widget") as HTMLElement;
    const cell = container.querySelector("#cell") as HTMLElement;

    const state: FocusState = {
      hadFocus: true,
      focusPath: '[data-row="1"][data-col="2"]',
      selectionStart: 0,
      selectionEnd: 0,
    };

    restoreFocus(widget, state);

    expect(document.activeElement).toBe(cell);
  });

  it("restores cursor position in contenteditable", () => {
    container.innerHTML = `
      <div id="widget">
        <div contenteditable data-row="0" data-col="0" id="cell">Hello World</div>
      </div>
    `;
    const widget = container.querySelector("#widget") as HTMLElement;
    const cell = container.querySelector("#cell") as HTMLElement;

    const state: FocusState = {
      hadFocus: true,
      focusPath: '[data-row="0"][data-col="0"]',
      selectionStart: 2,
      selectionEnd: 5,
    };

    restoreFocus(widget, state);

    expect(document.activeElement).toBe(cell);
    const sel = document.getSelection();
    expect(sel?.rangeCount).toBe(1);
    const range = sel?.getRangeAt(0);
    expect(range?.startOffset).toBe(2);
    expect(range?.endOffset).toBe(5);
  });

  it("clamps selection to actual content length", () => {
    container.innerHTML = `
      <div id="widget">
        <div contenteditable data-row="0" data-col="0" id="cell">Hi</div>
      </div>
    `;
    const widget = container.querySelector("#widget") as HTMLElement;
    // cell is implicitly tested via the selector in focusPath

    // State has offsets beyond content length
    const state: FocusState = {
      hadFocus: true,
      focusPath: '[data-row="0"][data-col="0"]',
      selectionStart: 100,
      selectionEnd: 200,
    };

    restoreFocus(widget, state);

    // Should clamp to content length (2)
    const sel = document.getSelection();
    const range = sel?.getRangeAt(0);
    expect(range?.startOffset).toBe(2);
    expect(range?.endOffset).toBe(2);
  });

  it("handles missing target element gracefully", () => {
    container.innerHTML = `<div id="widget"></div>`;
    const widget = container.querySelector("#widget") as HTMLElement;

    const state: FocusState = {
      hadFocus: true,
      focusPath: '[data-row="99"][data-col="99"]', // Doesn't exist
      selectionStart: 0,
      selectionEnd: 0,
    };

    // Should not throw
    expect(() => restoreFocus(widget, state)).not.toThrow();
  });
});

describe("captureFocus + restoreFocus round-trip", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it("preserves focus through DOM rebuild", () => {
    // Initial DOM
    container.innerHTML = `
      <div id="widget">
        <table>
          <tr>
            <td contenteditable data-row="0" data-col="0" id="cell-0-0">A</td>
            <td contenteditable data-row="0" data-col="1" id="cell-0-1">B</td>
          </tr>
        </table>
      </div>
    `;
    const widget = container.querySelector("#widget") as HTMLElement;
    const cell = container.querySelector("#cell-0-1") as HTMLElement;
    cell.focus();

    // Set cursor at position 1
    const range = document.createRange();
    range.setStart(cell.firstChild!, 1);
    range.setEnd(cell.firstChild!, 1);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    // Capture state
    const state = captureFocus(widget);

    // Simulate DOM rebuild (replace content)
    container.innerHTML = `
      <div id="widget">
        <table>
          <tr>
            <td contenteditable data-row="0" data-col="0">A</td>
            <td contenteditable data-row="0" data-col="1">B-Updated</td>
          </tr>
        </table>
      </div>
    `;
    const newWidget = container.querySelector("#widget") as HTMLElement;
    const newCell = container.querySelector('[data-row="0"][data-col="1"]') as HTMLElement;

    // Restore focus
    restoreFocus(newWidget, state);

    // Verify focus was restored
    expect(document.activeElement).toBe(newCell);
  });
});

// ===========================================
// WidgetEventManager TESTS
// ===========================================

describe("WidgetEventManager", () => {
  let container: HTMLDivElement;
  let manager: WidgetEventManager;
  let mockView: EditorView;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    manager = new WidgetEventManager();
    mockView = createMockView();
    vi.clearAllMocks();
  });

  afterEach(() => {
    manager.detachAll();
    container.remove();
  });

  describe("attach", () => {
    it("attaches managed handler to element", () => {
      container.innerHTML = `
        <div data-widget-from="10">
          <button id="btn">Click</button>
        </div>
      `;
      const btn = container.querySelector("#btn") as HTMLElement;
      const handler = vi.fn();

      manager.attach(btn, "click", MOCK_CONFIG, mockView, handler);
      btn.click();

      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][1].anchorValue).toBe(10);
    });

    it("supports multiple handlers on same element", () => {
      container.innerHTML = `
        <div data-widget-from="20">
          <input id="input" type="text" />
        </div>
      `;
      const input = container.querySelector("#input") as HTMLElement;
      const clickHandler = vi.fn();
      const focusHandler = vi.fn();

      manager.attach(input, "click", MOCK_CONFIG, mockView, clickHandler);
      manager.attach(input, "focus", MOCK_CONFIG, mockView, focusHandler);

      input.click();
      input.focus();

      expect(clickHandler).toHaveBeenCalledOnce();
      expect(focusHandler).toHaveBeenCalledOnce();
    });
  });

  describe("attachRaw", () => {
    it("attaches raw handler without managed context", () => {
      container.innerHTML = `<button id="btn">Click</button>`;
      const btn = container.querySelector("#btn") as HTMLElement;
      const handler = vi.fn();

      manager.attachRaw(btn, "click", handler);
      btn.click();

      expect(handler).toHaveBeenCalledOnce();
      // Raw handler gets just the event, not context
      expect(handler.mock.calls[0].length).toBe(1);
      expect(handler.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
    });
  });

  describe("detach", () => {
    it("removes handlers from specific element", () => {
      container.innerHTML = `
        <div data-widget-from="5">
          <button id="btn1">Button 1</button>
          <button id="btn2">Button 2</button>
        </div>
      `;
      const btn1 = container.querySelector("#btn1") as HTMLElement;
      const btn2 = container.querySelector("#btn2") as HTMLElement;
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.attach(btn1, "click", MOCK_CONFIG, mockView, handler1);
      manager.attach(btn2, "click", MOCK_CONFIG, mockView, handler2);

      // Detach only btn1
      manager.detach(btn1);

      btn1.click();
      btn2.click();

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it("removes all handlers from element with multiple events", () => {
      container.innerHTML = `
        <div data-widget-from="5">
          <input id="input" />
        </div>
      `;
      const input = container.querySelector("#input") as HTMLElement;
      const clickHandler = vi.fn();
      const focusHandler = vi.fn();

      manager.attach(input, "click", MOCK_CONFIG, mockView, clickHandler);
      manager.attach(input, "focus", MOCK_CONFIG, mockView, focusHandler);

      manager.detach(input);

      input.click();
      input.focus();

      expect(clickHandler).not.toHaveBeenCalled();
      expect(focusHandler).not.toHaveBeenCalled();
    });
  });

  describe("detachAll", () => {
    it("removes all handlers from all elements", () => {
      container.innerHTML = `
        <div data-widget-from="1">
          <button id="btn1">Button 1</button>
          <button id="btn2">Button 2</button>
          <button id="btn3">Button 3</button>
        </div>
      `;
      const btn1 = container.querySelector("#btn1") as HTMLElement;
      const btn2 = container.querySelector("#btn2") as HTMLElement;
      const btn3 = container.querySelector("#btn3") as HTMLElement;
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      manager.attach(btn1, "click", MOCK_CONFIG, mockView, handler1);
      manager.attach(btn2, "click", MOCK_CONFIG, mockView, handler2);
      manager.attachRaw(btn3, "click", handler3);

      manager.detachAll();

      btn1.click();
      btn2.click();
      btn3.click();

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });

    it("can be called multiple times safely", () => {
      container.innerHTML = `
        <div data-widget-from="1">
          <button id="btn">Button</button>
        </div>
      `;
      const btn = container.querySelector("#btn") as HTMLElement;
      manager.attach(btn, "click", MOCK_CONFIG, mockView, vi.fn());

      // Call multiple times
      expect(() => {
        manager.detachAll();
        manager.detachAll();
        manager.detachAll();
      }).not.toThrow();
    });
  });
});
