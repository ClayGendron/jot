/**
 * Markdown to HTML converter
 *
 * Converts standard Markdown to HTML that TipTap can understand.
 * Handles common elements: headings, paragraphs, lists, code, tables, etc.
 */

import { isInternalLink } from "../links/resolver";

/**
 * Convert Markdown string to HTML
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "<p></p>";

  let html = markdown;

  // Normalize line endings
  html = html.replace(/\r\n/g, "\n");

  // Process code blocks first (to protect them from other processing)
  const codeBlocks: string[] = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const index = codeBlocks.length;
    const langAttr = lang ? ` class="language-${lang}"` : "";
    codeBlocks.push(`<pre><code${langAttr}>${escapeHtml(code.trim())}</code></pre>`);
    return `%%CODEBLOCK${index}%%`;
  });

  // Process inline code (to protect from other processing)
  const inlineCodes: string[] = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const index = inlineCodes.length;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `%%INLINECODE${index}%%`;
  });

  // Process tables
  html = processTable(html);

  // Process block elements
  html = processBlockElements(html);

  // Process inline elements
  html = processInlineElements(html);

  // Restore code blocks
  codeBlocks.forEach((block, index) => {
    html = html.replace(`%%CODEBLOCK${index}%%`, block);
  });

  // Restore inline code
  inlineCodes.forEach((code, index) => {
    html = html.replace(`%%INLINECODE${index}%%`, code);
  });

  // Clean up multiple newlines
  html = html.replace(/\n{3,}/g, "\n\n");

  // Wrap remaining text in paragraphs
  html = wrapInParagraphs(html);

  return html.trim();
}

/**
 * Process block-level elements
 */
function processBlockElements(html: string): string {
  // Headings
  html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Horizontal rules
  html = html.replace(/^[-*_]{3,}$/gm, "<hr />");

  // Blockquotes
  html = processBlockquotes(html);

  // Lists
  html = processLists(html);

  return html;
}

/**
 * Process blockquotes
 */
function processBlockquotes(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inBlockquote = false;
  let blockquoteContent: string[] = [];

  for (const line of lines) {
    if (line.startsWith("> ")) {
      if (!inBlockquote) {
        inBlockquote = true;
        blockquoteContent = [];
      }
      blockquoteContent.push(line.slice(2));
    } else if (line === ">" && inBlockquote) {
      blockquoteContent.push("");
    } else {
      if (inBlockquote) {
        result.push(`<blockquote><p>${blockquoteContent.join(" ")}</p></blockquote>`);
        inBlockquote = false;
        blockquoteContent = [];
      }
      result.push(line);
    }
  }

  if (inBlockquote) {
    result.push(`<blockquote><p>${blockquoteContent.join(" ")}</p></blockquote>`);
  }

  return result.join("\n");
}

/**
 * Process lists (unordered, ordered, and task lists)
 */
function processLists(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let listStack: { type: "ul" | "ol"; indent: number }[] = [];

  const flushList = () => {
    while (listStack.length > 0) {
      const list = listStack.pop()!;
      result.push(`</${list.type}>`);
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)$/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    const taskMatch = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/);

    if (taskMatch) {
      const [, indent, checked, content] = taskMatch;
      const indentLevel = indent.length;
      const isChecked = checked.toLowerCase() === "x";

      adjustListStack(listStack, result, indentLevel, "ul");

      const checkedAttr = isChecked ? " checked" : "";
      result.push(
        `<li><label><input type="checkbox"${checkedAttr} disabled /> ${processInlineElements(content)}</label></li>`
      );
    } else if (ulMatch) {
      const [, indent, content] = ulMatch;
      const indentLevel = indent.length;

      adjustListStack(listStack, result, indentLevel, "ul");
      result.push(`<li>${processInlineElements(content)}</li>`);
    } else if (olMatch) {
      const [, indent, content] = olMatch;
      const indentLevel = indent.length;

      adjustListStack(listStack, result, indentLevel, "ol");
      result.push(`<li>${processInlineElements(content)}</li>`);
    } else {
      flushList();
      result.push(line);
    }
  }

  flushList();
  return result.join("\n");
}

/**
 * Adjust list stack for proper nesting
 */
function adjustListStack(
  stack: { type: "ul" | "ol"; indent: number }[],
  result: string[],
  indent: number,
  type: "ul" | "ol"
): void {
  // Close lists that are more indented
  while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
    const list = stack.pop()!;
    result.push(`</${list.type}>`);
  }

  // Open new list if needed
  if (stack.length === 0 || stack[stack.length - 1].indent < indent) {
    result.push(`<${type}>`);
    stack.push({ type, indent });
  }
}

/**
 * Process tables
 */
function processTable(html: string): string {
  const lines = html.split("\n");
  const result: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  for (const line of lines) {
    if (line.match(/^\|(.+)\|$/)) {
      // Check if it's a separator row
      if (line.match(/^\|[\s\-:|]+\|$/)) {
        continue; // Skip separator row
      }

      if (!inTable) {
        inTable = true;
        tableRows = [];
      }

      const cells = line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());
      tableRows.push(cells);
    } else {
      if (inTable) {
        result.push(convertTableRowsToHtml(tableRows));
        inTable = false;
        tableRows = [];
      }
      result.push(line);
    }
  }

  if (inTable) {
    result.push(convertTableRowsToHtml(tableRows));
  }

  return result.join("\n");
}

/**
 * Convert table rows to HTML
 */
function convertTableRowsToHtml(rows: string[][]): string {
  if (rows.length === 0) return "";

  const headerRow = rows[0];
  const bodyRows = rows.slice(1);

  let html = "<table>";
  html += "<thead><tr>";
  headerRow.forEach((cell) => {
    html += `<th>${processInlineElements(cell)}</th>`;
  });
  html += "</tr></thead>";

  if (bodyRows.length > 0) {
    html += "<tbody>";
    bodyRows.forEach((row) => {
      html += "<tr>";
      row.forEach((cell) => {
        html += `<td>${processInlineElements(cell)}</td>`;
      });
      html += "</tr>";
    });
    html += "</tbody>";
  }

  html += "</table>";
  return html;
}

/**
 * Process inline elements
 */
function processInlineElements(html: string): string {
  // Bold (must come before italic to handle ***)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.+?)_/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<s>$1</s>");

  // Highlight (non-standard but supported by TipTap)
  html = html.replace(/==(.+?)==/g, "<mark>$1</mark>");

  // Images (must come before links to handle ![alt](url) vs [text](url))
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Links (detect internal .md links and add special class)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, href) => {
    if (isInternalLink(href)) {
      return `<a href="${href}" class="internal-link" data-internal-link="true">${text}</a>`;
    }
    return `<a href="${href}">${text}</a>`;
  });

  // Line breaks (two spaces at end of line)
  html = html.replace(/  $/gm, "<br />");

  return html;
}

/**
 * Wrap remaining text in paragraphs
 */
function wrapInParagraphs(html: string): string {
  const blocks = html.split(/\n\n+/);

  return blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";

      // Don't wrap if already a block element
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<p") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<li") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<table") ||
        trimmed.startsWith("<hr")
      ) {
        return trimmed;
      }

      // Wrap in paragraph
      return `<p>${trimmed}</p>`;
    })
    .filter(Boolean)
    .join("");
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default markdownToHtml;
