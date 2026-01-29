/**
 * HTML to Markdown converter
 *
 * Uses Turndown for robust HTML to Markdown conversion.
 * Configured for TipTap's HTML output format.
 */

import TurndownService from "turndown";

// Create turndown instance with appropriate options
const turndown = new TurndownService({
  headingStyle: "atx", // Use # style headings
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  fence: "```",
  emDelimiter: "*",
  strongDelimiter: "**",
  linkStyle: "inlined",
});

// Configure turndown to handle TipTap-specific elements

// Handle task list checkboxes
turndown.addRule("taskListItem", {
  filter: (node) => {
    return (
      node.nodeName === "LI" &&
      node.querySelector('input[type="checkbox"]') !== null
    );
  },
  replacement: (content, node) => {
    const checkbox = (node as HTMLElement).querySelector('input[type="checkbox"]');
    const isChecked = checkbox?.hasAttribute("checked");
    const checkMark = isChecked ? "[x]" : "[ ]";
    // Clean up the content - remove extra whitespace
    const cleanContent = content.replace(/^\s*/, "").replace(/\n+$/, "");
    return `- ${checkMark} ${cleanContent}\n`;
  },
});

// Handle highlight/mark elements (TipTap uses <mark>)
turndown.addRule("highlight", {
  filter: ["mark"],
  replacement: (content) => {
    return `==${content}==`;
  },
});

// Handle strikethrough (TipTap uses <s>)
turndown.addRule("strikethrough", {
  filter: ["s", "del"],
  replacement: (content) => {
    return `~~${content}~~`;
  },
});

// Keep code blocks with language class
turndown.addRule("fencedCodeBlock", {
  filter: (node) => {
    return (
      node.nodeName === "PRE" &&
      node.firstChild?.nodeName === "CODE"
    );
  },
  replacement: (_content, node) => {
    const codeNode = node.firstChild as HTMLElement;
    const className = codeNode.getAttribute("class") || "";
    const langMatch = className.match(/language-(\w+)/);
    const language = langMatch ? langMatch[1] : "";
    const code = codeNode.textContent || "";
    return `\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
  },
});

// Handle images properly
turndown.addRule("image", {
  filter: "img",
  replacement: (_content, node) => {
    const img = node as HTMLImageElement;
    const alt = img.getAttribute("alt") || "";
    const src = img.getAttribute("src") || "";
    return `![${alt}](${src})`;
  },
});

// Handle tables
turndown.addRule("table", {
  filter: "table",
  replacement: (_content, node) => {
    const table = node as HTMLTableElement;
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length === 0) return "";

    const lines: string[] = [];

    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll("th, td"));
      const cellContents = cells.map((cell) => {
        // Get text content and handle inline formatting
        return getCellContent(cell as HTMLElement)
          .trim()
          .replace(/\|/g, "\\|")
          .replace(/\n/g, " ");
      });

      lines.push(`| ${cellContents.join(" | ")} |`);

      // Add separator after header row
      if (rowIndex === 0) {
        const separator = cells.map(() => "---").join(" | ");
        lines.push(`| ${separator} |`);
      }
    });

    return `\n${lines.join("\n")}\n\n`;
  },
});

// Skip table child elements (handled by table rule)
turndown.addRule("tableElements", {
  filter: ["thead", "tbody", "tfoot", "tr", "th", "td"],
  replacement: () => "",
});

/**
 * Get cell content with inline formatting
 */
function getCellContent(element: HTMLElement): string {
  let text = "";

  element.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      text += child.textContent || "";
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      const innerText = getCellContent(el);

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
 * Convert HTML string to Markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html === "<p></p>") return "";

  // Use turndown to convert
  let markdown = turndown.turndown(html);

  // Clean up excessive newlines
  markdown = markdown.replace(/\n{3,}/g, "\n\n");

  // Trim whitespace
  markdown = markdown.trim();

  return markdown;
}

export default htmlToMarkdown;
