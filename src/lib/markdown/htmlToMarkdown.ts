/**
 * HTML to Markdown converter
 *
 * Converts TipTap's HTML output to standard Markdown.
 * Handles common elements: headings, paragraphs, lists, code, tables, etc.
 */

/**
 * Convert HTML string to Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html === "<p></p>") return "";

  // Create a temporary DOM element to parse HTML
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;

  return convertNode(body).trim();
}

/**
 * Recursively convert DOM nodes to Markdown
 */
function convertNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdown(node.textContent || "");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();
  const children = Array.from(element.childNodes)
    .map((child) => convertNode(child))
    .join("");

  switch (tagName) {
    // Block elements
    case "p":
      return children + "\n\n";

    case "h1":
      return `# ${children}\n\n`;
    case "h2":
      return `## ${children}\n\n`;
    case "h3":
      return `### ${children}\n\n`;
    case "h4":
      return `#### ${children}\n\n`;
    case "h5":
      return `##### ${children}\n\n`;
    case "h6":
      return `###### ${children}\n\n`;

    case "blockquote":
      return (
        children
          .trim()
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n") + "\n\n"
      );

    case "hr":
      return "---\n\n";

    // Lists
    case "ul":
      return convertList(element, false) + "\n";
    case "ol":
      return convertList(element, true) + "\n";
    case "li":
      return children;

    // Task lists
    case "input":
      if (element.getAttribute("type") === "checkbox") {
        const checked = element.hasAttribute("checked");
        return checked ? "[x] " : "[ ] ";
      }
      return "";

    // Inline elements
    case "strong":
    case "b":
      return `**${children}**`;
    case "em":
    case "i":
      return `*${children}*`;
    case "s":
    case "del":
    case "strike":
      return `~~${children}~~`;
    case "code":
      // Check if inside a pre (code block)
      if (element.parentElement?.tagName.toLowerCase() === "pre") {
        return children;
      }
      return `\`${children}\``;
    case "mark":
      return `==${children}==`;

    // Links and images
    case "a": {
      const href = element.getAttribute("href") || "";
      return `[${children}](${href})`;
    }
    case "img": {
      const src = element.getAttribute("src") || "";
      const alt = element.getAttribute("alt") || "";
      return `![${alt}](${src})`;
    }

    // Code blocks
    case "pre": {
      const codeElement = element.querySelector("code");
      const language = codeElement?.getAttribute("class")?.match(/language-(\w+)/)?.[1] || "";
      const code = codeElement?.textContent || element.textContent || "";
      return `\`\`\`${language}\n${code}\n\`\`\`\n\n`;
    }

    // Tables
    case "table":
      return convertTable(element) + "\n";
    case "thead":
    case "tbody":
    case "tfoot":
      return children;
    case "tr":
      return "";
    case "th":
    case "td":
      return "";

    // Task list container
    case "label":
      return children;

    // Container elements
    case "div":
    case "span":
    case "body":
      return children;

    // Line breaks
    case "br":
      return "  \n";

    default:
      return children;
  }
}

/**
 * Convert list element to markdown
 */
function convertList(list: HTMLElement, ordered: boolean, depth = 0): string {
  const items = Array.from(list.children);
  const indent = "  ".repeat(depth);
  const lines: string[] = [];

  items.forEach((item, index) => {
    if (item.tagName.toLowerCase() !== "li") return;

    const marker = ordered ? `${index + 1}.` : "-";
    const isTaskList = item.querySelector('input[type="checkbox"]') !== null;

    // Handle task list items
    if (isTaskList) {
      const checkbox = item.querySelector('input[type="checkbox"]');
      const checked = checkbox?.hasAttribute("checked");
      const checkboxMark = checked ? "[x]" : "[ ]";

      // Get text content, excluding nested lists
      const content = getListItemContent(item);
      lines.push(`${indent}${marker} ${checkboxMark} ${content}`);
    } else {
      // Get text content, excluding nested lists
      const content = getListItemContent(item);
      lines.push(`${indent}${marker} ${content}`);
    }

    // Handle nested lists
    const nestedLists = item.querySelectorAll(":scope > ul, :scope > ol");
    nestedLists.forEach((nestedList) => {
      const isOrdered = nestedList.tagName.toLowerCase() === "ol";
      lines.push(convertList(nestedList as HTMLElement, isOrdered, depth + 1));
    });
  });

  return lines.join("\n");
}

/**
 * Get list item content excluding nested lists
 */
function getListItemContent(li: Element): string {
  const clone = li.cloneNode(true) as HTMLElement;
  // Remove nested lists from clone
  clone.querySelectorAll("ul, ol").forEach((list) => list.remove());
  // Remove checkboxes (already handled)
  clone.querySelectorAll('input[type="checkbox"]').forEach((cb) => cb.remove());
  clone.querySelectorAll("label").forEach((label) => {
    const parent = label.parentNode;
    while (label.firstChild) {
      parent?.insertBefore(label.firstChild, label);
    }
    label.remove();
  });

  return convertNode(clone).trim().replace(/\n+/g, " ");
}

/**
 * Convert table element to markdown
 */
function convertTable(table: HTMLElement): string {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) return "";

  const lines: string[] = [];

  rows.forEach((row, rowIndex) => {
    const cells = Array.from(row.querySelectorAll("th, td"));
    const cellContents = cells.map((cell) => {
      // Get the text content of the cell, handling inline formatting
      const content = getTextContent(cell);
      return content.trim().replace(/\|/g, "\\|").replace(/\n/g, " ");
    });

    lines.push(`| ${cellContents.join(" | ")} |`);

    // Add separator after header row
    if (rowIndex === 0) {
      const separator = cells.map(() => "---").join(" | ");
      lines.push(`| ${separator} |`);
    }
  });

  return lines.join("\n");
}

/**
 * Get text content from element, handling inline formatting
 */
function getTextContent(element: Element): string {
  let text = "";

  element.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || "";
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      const innerText = getTextContent(el);

      switch (tagName) {
        case "strong":
        case "b":
          text += `**${innerText}**`;
          break;
        case "em":
        case "i":
          text += `*${innerText}*`;
          break;
        case "code":
          text += `\`${innerText}\``;
          break;
        case "a":
          text += `[${innerText}](${el.getAttribute("href") || ""})`;
          break;
        default:
          text += innerText;
      }
    }
  });

  return text;
}

/**
 * Escape special markdown characters in text
 */
function escapeMarkdown(text: string): string {
  // Don't escape inside code blocks or inline code
  // Only escape characters that would be interpreted as markdown
  return text;
}

export default htmlToMarkdown;
