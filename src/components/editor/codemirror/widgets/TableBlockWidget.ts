/**
 * Table Block Widget
 *
 * Widget that renders a block-level HTML table for GFM tables.
 * Cells are contentEditable and sync directly to markdown.
 *
 * Uses ManagedWidget pattern for event handlers to avoid stale closure issues.
 * Event handlers read tableFrom from DOM and re-parse data on each event.
 */

import { WidgetType, type EditorView } from "@codemirror/view";
import {
  captureFocus,
  restoreFocus,
  WidgetEventManager,
  type ManagedWidgetConfig,
} from "../utils/managedWidget";
import {
  getCurrentTableInfo,
  generateTableMarkdown,
  type TableInfo,
} from "../parsers/tableParser";
import {
  addTableRow,
  removeTableRow,
  addTableColumn,
  removeTableColumn,
} from "../handlers/tableHandlers";

// ===========================================
// HTML/MARKDOWN CONVERSION
// ===========================================

/**
 * Simple HTML entity escaping for cell content.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Render inline markdown for table cells (bold, italic, code, strike, highlight, links).
 * This is intentionally lightweight and does not handle full markdown.
 */
function renderInlineMarkdown(text: string): string {
  const escaped = escapeHtml(text);

  const codePlaceholders: string[] = [];
  let html = escaped.replace(/`([^`]+)`/g, (_m, code) => {
    const idx = codePlaceholders.length;
    codePlaceholders.push(`<code class="cm-inline-code">${code}</code>`);
    return `\u0000CODE${idx}\u0000`;
  });

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
    const safeUrl = url.replace(/"/g, "&quot;");
    return `<a href="${safeUrl}" class="cm-link" rel="noopener noreferrer" target="_blank">${label}</a>`;
  });

  html = html.replace(/\*\*([^*]+)\*\*/g, `<strong class="cm-strong">$1</strong>`);
  html = html.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, `$1<em class="cm-em">$2</em>`);
  html = html.replace(/~~([^~]+)~~/g, `<s class="cm-strikethrough">$1</s>`);
  html = html.replace(/==([^=]+)==/g, `<mark class="cm-highlight">$1</mark>`);

  html = html.replace(/\u0000CODE(\d+)\u0000/g, (_m, idx) => codePlaceholders[Number(idx)]);
  return html;
}

/**
 * Convert HTML back to markdown (inverse of renderInlineMarkdown).
 * Used for WYSIWYG table cell editing - users edit rendered HTML,
 * and we convert back to markdown for storage.
 */
function htmlToMarkdown(html: string): string {
  // Create a temporary element to parse the HTML
  const div = document.createElement("div");
  div.innerHTML = html;

  // Recursive function to convert a node to markdown
  function convertNode(node: Node): string {
    // Text nodes: just return text content
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || "";
    }

    // Element nodes: process based on tag
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      // Get the converted content of child nodes
      const childContent = Array.from(el.childNodes)
        .map(convertNode)
        .join("");

      // Convert based on tag
      switch (tagName) {
        case "strong":
        case "b":
          return childContent ? `**${childContent}**` : "";
        case "em":
        case "i":
          return childContent ? `*${childContent}*` : "";
        case "code":
          return childContent ? `\`${childContent}\`` : "";
        case "s":
        case "del":
        case "strike":
          return childContent ? `~~${childContent}~~` : "";
        case "mark":
          return childContent ? `==${childContent}==` : "";
        case "a": {
          const href = el.getAttribute("href") || "";
          return childContent ? `[${childContent}](${href})` : "";
        }
        case "br":
          return "";
        default:
          // For unknown tags, just return the content
          return childContent;
      }
    }

    return "";
  }

  // Convert all child nodes
  const result = Array.from(div.childNodes)
    .map(convertNode)
    .join("");

  // Decode HTML entities
  // Note: DOM parser converts &nbsp; to U+00A0, so we replace the actual character
  const decoded = result
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\u00A0/g, " ");

  return decoded;
}

// ===========================================
// TABLE BLOCK WIDGET
// ===========================================

/**
 * Configuration for TableBlockWidget managed event handlers.
 * Uses composition pattern - simple widgets don't need this machinery.
 */
const TABLE_WIDGET_CONFIG: ManagedWidgetConfig<TableInfo> = {
  widgetKey: "table-block",
  anchorAttr: "table-from",
  reparse: getCurrentTableInfo,
};

/**
 * Widget that renders a block-level HTML table for GFM tables.
 * Cells are contentEditable and sync directly to markdown.
 *
 * Uses ManagedWidget pattern for event handlers to avoid stale closure issues.
 * Event handlers read tableFrom from DOM and re-parse data on each event.
 */
export class TableBlockWidget extends WidgetType {
  /** Manages lifecycle of event handlers attached to cells/buttons */
  private eventManager = new WidgetEventManager();

  constructor(
    readonly tableFrom: number,
    readonly initialColumnCount: number,  // For eq() comparison only
    readonly initialRowCount: number      // For eq() comparison only
  ) {
    super();
  }

  eq(other: TableBlockWidget) {
    return this.tableFrom === other.tableFrom
      && this.initialColumnCount === other.initialColumnCount
      && this.initialRowCount === other.initialRowCount;
  }

  /** Re-parse table on every access to avoid stale data */
  private getTableInfo(view: EditorView): TableInfo | null {
    return getCurrentTableInfo(view, this.tableFrom);
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    // 1. Capture focus state BEFORE any changes using managed focus utilities
    const focusState = captureFocus(dom);

    // 2. Re-parse table info fresh
    const tableInfo = this.getTableInfo(view);
    if (!tableInfo) return false;

    // Update stable identifier (in case position changed)
    dom.dataset.tableFrom = String(this.tableFrom);
    this.applyTableWidth(dom, view);
    const table = dom.querySelector("table.cm-table");
    if (!table) return false;

    const colCount = tableInfo.columnCount;
    const headerCells = Array.from(table.querySelectorAll("thead th"));
    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));

    if (headerCells.length !== colCount) return false;
    if (bodyRows.length !== tableInfo.bodyRows.length) return false;

    // 3. Update table cells (skip focused cell to avoid interrupting WYSIWYG editing)
    const savedFocusRow = focusState.focusPath?.match(/data-row="(\d+)"/)?.[1] ?? null;
    const savedFocusCol = focusState.focusPath?.match(/data-col="(\d+)"/)?.[1] ?? null;

    for (let col = 0; col < colCount; col++) {
      const cell = headerCells[col] as HTMLElement;
      const raw = tableInfo.headerCells[col]?.content ?? "";
      const isFocused = cell.dataset.row === savedFocusRow && cell.dataset.col === savedFocusCol;
      if (isFocused) {
        // Don't overwrite focused cell - user is editing (just update dataset)
        cell.dataset.raw = raw;
      } else {
        this.renderCell(cell, raw);
      }
    }

    for (let rowIdx = 0; rowIdx < tableInfo.bodyRows.length; rowIdx++) {
      const row = tableInfo.bodyRows[rowIdx];
      const rowCells = Array.from(bodyRows[rowIdx].querySelectorAll("td"));
      if (rowCells.length !== colCount) return false;
      for (let col = 0; col < colCount; col++) {
        const cell = rowCells[col] as HTMLElement;
        const raw = row[col]?.content ?? "";
        const isFocused = cell.dataset.row === String(rowIdx + 1) && cell.dataset.col === String(col);
        if (isFocused) {
          // Don't overwrite focused cell - user is editing (just update dataset)
          cell.dataset.raw = raw;
        } else {
          this.renderCell(cell, raw);
        }
      }
    }

    // 4. Restore focus if we had it using managed focus utilities
    restoreFocus(dom, focusState);

    return true;
  }

  toDOM(view: EditorView) {
    const tableInfo = this.getTableInfo(view);
    if (!tableInfo) {
      // Fallback: empty div if table can't be parsed
      const wrapper = document.createElement("div");
      wrapper.className = "cm-table-block";
      wrapper.dataset.tableFrom = String(this.tableFrom);
      return wrapper;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "cm-table-block";
    wrapper.dataset.tableFrom = String(this.tableFrom);
    this.applyTableWidth(wrapper, view);

    // Create toolbar container
    const toolbar = this.createToolbar(view);
    wrapper.appendChild(toolbar);

    const table = document.createElement("table");
    table.className = "cm-table";

    const colCount = tableInfo.columnCount;

    // Header
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    headerRow.className = "cm-table-header-row";

    for (let col = 0; col < colCount; col++) {
      const cell = tableInfo.headerCells[col];
      const th = document.createElement("th");
      th.className = "cm-table-header-cell";
      th.contentEditable = "true";
      th.dataset.raw = cell?.content ?? "";
      th.dataset.row = "0";
      th.dataset.col = String(col);
      // Apply column alignment from markdown
      this.applyColumnAlignment(th, col, tableInfo);
      this.attachCellHandlers(th, view);
      this.renderCell(th);
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement("tbody");
    for (let rowIdx = 0; rowIdx < tableInfo.bodyRows.length; rowIdx++) {
      const row = tableInfo.bodyRows[rowIdx];
      const tr = document.createElement("tr");
      tr.className = rowIdx % 2 === 0
        ? "cm-table-body-row cm-table-row-odd"
        : "cm-table-body-row cm-table-row-even";

      for (let col = 0; col < colCount; col++) {
        const cell = row[col];
        const td = document.createElement("td");
        td.className = "cm-table-body-cell";
        td.contentEditable = "true";
        td.dataset.raw = cell?.content ?? "";
        td.dataset.row = String(rowIdx + 1);
        td.dataset.col = String(col);
        // Apply column alignment from markdown
        this.applyColumnAlignment(td, col, tableInfo);
        this.attachCellHandlers(td, view);
        this.renderCell(td);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
  }

  private createToolbar(view: EditorView): HTMLElement {
    const toolbar = document.createElement("div");
    toolbar.className = "cm-table-toolbar";

    // Row controls
    const rowGroup = document.createElement("div");
    rowGroup.className = "cm-table-toolbar-group";

    const addRowBtn = this.createToolbarButton("+ Row", "Add row");
    this.eventManager.attach(addRowBtn, "click", TABLE_WIDGET_CONFIG, view,
      (e, { data: tableInfo }) => {
        e.preventDefault();
        e.stopPropagation();
        addTableRow(view, tableInfo);
      }
    );

    const removeRowBtn = this.createToolbarButton("\u2212 Row", "Remove row");
    this.eventManager.attach(removeRowBtn, "click", TABLE_WIDGET_CONFIG, view,
      (e, { data: tableInfo }) => {
        e.preventDefault();
        e.stopPropagation();
        removeTableRow(view, tableInfo);
      }
    );

    rowGroup.appendChild(addRowBtn);
    rowGroup.appendChild(removeRowBtn);

    // Column controls
    const colGroup = document.createElement("div");
    colGroup.className = "cm-table-toolbar-group";

    const addColBtn = this.createToolbarButton("+ Column", "Add column");
    this.eventManager.attach(addColBtn, "click", TABLE_WIDGET_CONFIG, view,
      (e, { data: tableInfo }) => {
        e.preventDefault();
        e.stopPropagation();
        addTableColumn(view, tableInfo);
      }
    );

    const removeColBtn = this.createToolbarButton("\u2212 Column", "Remove column");
    this.eventManager.attach(removeColBtn, "click", TABLE_WIDGET_CONFIG, view,
      (e, { data: tableInfo }) => {
        e.preventDefault();
        e.stopPropagation();
        removeTableColumn(view, tableInfo);
      }
    );

    colGroup.appendChild(addColBtn);
    colGroup.appendChild(removeColBtn);

    toolbar.appendChild(rowGroup);
    toolbar.appendChild(colGroup);

    return toolbar;
  }

  private createToolbarButton(label: string, title: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "cm-table-toolbar-btn";
    btn.textContent = label;
    btn.title = title;
    btn.type = "button";
    // Prevent focus from moving to button
    this.eventManager.attachRaw(btn, "mousedown", (e) => {
      e.preventDefault();
    });
    return btn;
  }

  attachCellHandlers(cell: HTMLElement, view: EditorView) {
    let updatePending = false;

    const syncToMarkdown = () => {
      if (updatePending) return;
      updatePending = true;

      requestAnimationFrame(() => {
        updatePending = false;
        const row = parseInt(cell.dataset.row ?? "", 10);
        const col = parseInt(cell.dataset.col ?? "", 10);
        if (Number.isNaN(row) || Number.isNaN(col)) return;

        // Convert HTML back to markdown (WYSIWYG: cells always show rendered HTML)
        const newContent = htmlToMarkdown(cell.innerHTML);
        cell.dataset.raw = newContent;

        // Read tableFrom from DOM - this stays current even when widget instance is stale
        const wrapper = cell.closest(".cm-table-block") as HTMLElement;
        const tableFromStr = wrapper?.dataset.tableFrom;
        if (!tableFromStr) return;
        const tableFrom = parseInt(tableFromStr, 10);

        // Re-parse table to get current state
        const currentInfo = getCurrentTableInfo(view, tableFrom);
        if (!currentInfo) return;

        // Update the cell content
        const headers = currentInfo.headerCells.map(c => c.content);
        const rows = currentInfo.bodyRows.map(r => r.map(c => c.content));

        if (row === 0) {
          headers[col] = newContent;
        } else if (rows[row - 1]) {
          rows[row - 1][col] = newContent;
        }

        // Generate new markdown and dispatch
        const newMd = generateTableMarkdown(headers, rows, currentInfo.columnAlignments, currentInfo.linePrefix);
        view.dispatch({
          changes: { from: currentInfo.from, to: currentInfo.to, insert: newMd }
        });
      });
    };

    // Input handler: sync HTML content to markdown (cells stay in rendered mode)
    cell.addEventListener("input", () => {
      syncToMarkdown();
    });

    // Blur handler: sync and re-render to normalize HTML
    cell.addEventListener("blur", () => {
      syncToMarkdown();
      // Delay render to allow focus to move
      requestAnimationFrame(() => {
        // Only render if cell is no longer focused
        if (cell !== cell.ownerDocument.activeElement) {
          this.renderCell(cell);
        }
      });
    });

    // Keyboard navigation
    cell.addEventListener("keydown", (e) => {
      const table = cell.closest("table")!;
      const wrapper = cell.closest(".cm-table-block") as HTMLElement;
      const cells = Array.from(table.querySelectorAll("th, td")) as HTMLElement[];
      const idx = cells.indexOf(cell);
      const row = parseInt(cell.dataset.row ?? "0", 10);
      const col = parseInt(cell.dataset.col ?? "0", 10);

      // Read tableFrom from DOM - this stays current even when widget instance is stale
      const tableFromStr = wrapper?.dataset.tableFrom;
      if (!tableFromStr) return;
      const tableFrom = parseInt(tableFromStr, 10);

      // Get fresh table info for each keydown
      const currentInfo = getCurrentTableInfo(view, tableFrom);
      const colCount = currentInfo?.columnCount ?? cells.length;
      const rowCount = currentInfo?.rowCount ?? 1;

      if (e.key === "Tab") {
        e.preventDefault();
        const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
        if (nextIdx >= 0 && nextIdx < cells.length) {
          cells[nextIdx].focus();
        } else if (!e.shiftKey && nextIdx >= cells.length) {
          // Tab at last cell - add row and focus same column in new row
          const info = getCurrentTableInfo(view, tableFrom);
          if (info) {
            addTableRow(view, info);
            // Double RAF to ensure decoration rebuild completes
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                // Find by stable identifier, not stale cell reference
                const wrapper = view.dom.querySelector(`.cm-table-block[data-table-from="${tableFrom}"]`);
                const newTable = wrapper?.querySelector("table");
                if (newTable) {
                  // Focus same column in new row (first column for Tab)
                  const newCells = newTable.querySelectorAll("tbody tr:last-child td");
                  if (newCells.length > 0) {
                    (newCells[0] as HTMLElement).focus();
                  }
                }
              });
            });
          }
        }
      } else if (e.key === "ArrowUp" && !e.shiftKey) {
        // Move to same column in previous row
        if (row > 0) {
          e.preventDefault();
          const prevRowIdx = row === 1 ? col : (row - 1) * colCount + col;
          if (prevRowIdx >= 0 && prevRowIdx < cells.length) {
            cells[prevRowIdx].focus();
          }
        }
      } else if (e.key === "ArrowDown" && !e.shiftKey) {
        // Move to same column in next row
        if (row < rowCount - 1) {
          e.preventDefault();
          const nextRowIdx = row === 0 ? colCount + col : (row + 1) * colCount + col;
          if (nextRowIdx >= 0 && nextRowIdx < cells.length) {
            cells[nextRowIdx].focus();
          }
        }
      } else if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Enter moves down in table, only adds row when on last body row
        e.preventDefault();
        if (row === 0) {
          // In header - move to first body cell in same column
          const bodyFirstIdx = colCount + col;
          if (bodyFirstIdx < cells.length) {
            cells[bodyFirstIdx].focus();
          }
        } else {
          // In body - check if last row
          const info = getCurrentTableInfo(view, tableFrom);
          if (info) {
            const bodyRowIdx = row - 1; // row 0 is header, so row 1 = body row 0
            if (bodyRowIdx < info.bodyRows.length - 1) {
              // NOT last row - move to next row, same column
              const tbody = cell.closest("table")?.querySelector("tbody");
              const nextRowCells = tbody?.querySelectorAll(`tr:nth-child(${bodyRowIdx + 2}) td`);
              if (nextRowCells && nextRowCells.length > col) {
                (nextRowCells[col] as HTMLElement).focus();
              }
            } else {
              // AT last row - add new row and focus same column
              addTableRow(view, info);
              // Double RAF to ensure decoration rebuild completes
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  // Find by stable identifier, not stale cell reference
                  const wrapper = view.dom.querySelector(`.cm-table-block[data-table-from="${tableFrom}"]`);
                  const newTable = wrapper?.querySelector("table");
                  if (newTable) {
                    const newCells = newTable.querySelectorAll("tbody tr:last-child td");
                    const targetCol = Math.min(col, newCells.length - 1);
                    if (newCells.length > targetCol) {
                      (newCells[targetCol] as HTMLElement).focus();
                    }
                  }
                });
              });
            }
          }
        }
      } else if (e.key === "Escape") {
        // Exit table editing and focus CodeMirror
        e.preventDefault();
        cell.blur();
        view.focus();
        // Move cursor after the table
        const info = getCurrentTableInfo(view, tableFrom);
        if (info) {
          view.dispatch({
            selection: { anchor: info.to }
          });
        }
      }

      // ========================================
      // Formatting keyboard shortcuts (WYSIWYG)
      // ========================================

      // Helper to apply formatting using execCommand
      const applyFormatting = (command: string) => {
        e.preventDefault();
        document.execCommand(command);
        syncToMarkdown();
      };

      // Cmd/Ctrl+B: Toggle bold
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        applyFormatting("bold");
      }
      // Cmd/Ctrl+I: Toggle italic
      else if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        applyFormatting("italic");
      }
      // Cmd/Ctrl+E: Toggle inline code (no native execCommand, use custom)
      else if ((e.metaKey || e.ctrlKey) && e.key === "e") {
        e.preventDefault();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          if (selectedText) {
            // Wrap in <code> tag
            const code = document.createElement("code");
            code.className = "cm-inline-code";
            code.textContent = selectedText;
            range.deleteContents();
            range.insertNode(code);
            // Move selection after the code element
            selection.collapseToEnd();
          }
        }
        syncToMarkdown();
      }
      // Cmd/Ctrl+K: Insert/edit link
      else if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();

          // Check if we're inside a link
          const anchorNode = selection.anchorNode;
          const linkEl = anchorNode?.parentElement?.closest("a");
          if (linkEl) {
            // Editing existing link
            const currentUrl = linkEl.getAttribute("href") || "";
            const newUrl = prompt("Edit link URL:", currentUrl);
            if (newUrl !== null) {
              if (newUrl === "") {
                // Remove link, keep text
                const text = document.createTextNode(linkEl.textContent || "");
                linkEl.replaceWith(text);
              } else {
                linkEl.setAttribute("href", newUrl);
              }
            }
          } else if (selectedText) {
            // Create new link with selected text
            const url = prompt("Enter link URL:");
            if (url) {
              const link = document.createElement("a");
              link.href = url;
              link.className = "cm-link";
              link.rel = "noopener noreferrer";
              link.target = "_blank";
              link.textContent = selectedText;
              range.deleteContents();
              range.insertNode(link);
              selection.collapseToEnd();
            }
          } else {
            // No selection - create empty link
            const url = prompt("Enter link URL:");
            if (url) {
              const text = prompt("Enter link text:", url) || url;
              const link = document.createElement("a");
              link.href = url;
              link.className = "cm-link";
              link.rel = "noopener noreferrer";
              link.target = "_blank";
              link.textContent = text;
              range.insertNode(link);
              selection.collapseToEnd();
            }
          }
        }
        syncToMarkdown();
      }
      // Cmd/Ctrl+Shift+S: Toggle strikethrough
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "s") {
        e.preventDefault();
        document.execCommand("strikeThrough");
        syncToMarkdown();
      }
      // Cmd/Ctrl+Shift+H: Toggle highlight
      else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "h") {
        e.preventDefault();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const selectedText = range.toString();
          if (selectedText) {
            // Check if already highlighted
            const anchorNode = selection.anchorNode;
            const markEl = anchorNode?.parentElement?.closest("mark");
            if (markEl) {
              // Remove highlight, keep text
              const text = document.createTextNode(markEl.textContent || "");
              markEl.replaceWith(text);
            } else {
              // Add highlight
              const mark = document.createElement("mark");
              mark.className = "cm-highlight";
              mark.textContent = selectedText;
              range.deleteContents();
              range.insertNode(mark);
              selection.collapseToEnd();
            }
          }
        }
        syncToMarkdown();
      }
    });
  }

  ignoreEvent() {
    // Return true = CodeMirror ignores event, browser/widget handles natively
    // This is REQUIRED for contentEditable cells to receive focus and input
    return true;
  }

  destroy() {
    // Clean up all managed event handlers
    this.eventManager.detachAll();
  }

  private applyTableWidth(wrapper: HTMLElement, view: EditorView) {
    const width = view.scrollDOM?.clientWidth || view.dom.clientWidth;
    if (width > 0) {
      wrapper.style.width = "100%";
      wrapper.style.maxWidth = `${width}px`;
    }
  }

  private applyColumnAlignment(cell: HTMLElement, colIndex: number, tableInfo: TableInfo) {
    const alignment = tableInfo.columnAlignments[colIndex] || "none";
    switch (alignment) {
      case "left":
        cell.style.textAlign = "left";
        break;
      case "center":
        cell.style.textAlign = "center";
        break;
      case "right":
        cell.style.textAlign = "right";
        break;
      default:
        // "none" defaults to left alignment
        cell.style.textAlign = "left";
        break;
    }
  }

  /**
   * Render a cell's content as HTML from its raw markdown.
   * Cells are always in rendered mode for WYSIWYG editing.
   */
  private renderCell(cell: HTMLElement, rawOverride?: string) {
    const raw = rawOverride ?? cell.dataset.raw ?? "";
    cell.dataset.raw = raw;
    cell.innerHTML = renderInlineMarkdown(raw);
  }
}
