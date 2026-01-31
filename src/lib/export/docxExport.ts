/**
 * Word/DOCX Export Functionality
 *
 * Exports TipTap editor content to Word format using the docx library.
 * Preserves formatting, headings, lists, tables, and images.
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Packer,
  type ISectionOptions,
} from "docx";

/**
 * Page size options for DOCX export
 */
export type DocxPageSize = "letter" | "a4" | "legal";

/**
 * Margin settings in twips (1/20th of a point, 1440 twips = 1 inch)
 */
export interface DocxMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * DOCX export options
 */
export interface DocxExportOptions {
  pageSize: DocxPageSize;
  margins: DocxMargins;
}

/**
 * Default DOCX export options
 */
export const DEFAULT_DOCX_OPTIONS: DocxExportOptions = {
  pageSize: "letter",
  margins: {
    top: 1080, // 0.75 inch
    bottom: 1080,
    left: 1080,
    right: 1080,
  },
};

/**
 * Page dimensions in twips (1 inch = 1440 twips)
 */
const PAGE_DIMENSIONS: Record<DocxPageSize, { width: number; height: number }> =
  {
    letter: { width: 12240, height: 15840 }, // 8.5 x 11 inches
    a4: { width: 11906, height: 16838 }, // 210 x 297 mm
    legal: { width: 12240, height: 20160 }, // 8.5 x 14 inches
  };

/**
 * Generate a filename for DOCX export
 */
export function generateDocxFilename(sourceFilename: string): string {
  // Remove extension
  let baseName = sourceFilename.replace(/\.md$/i, "");

  // Clean up special characters
  baseName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  // Handle empty name
  if (!baseName) {
    baseName = "document";
  }

  // Truncate if too long
  if (baseName.length > 30) {
    baseName = baseName.slice(0, 30);
  }

  // Add timestamp
  const timestamp = new Date().toISOString().slice(0, 10);

  return `${baseName}-${timestamp}.docx`;
}

/**
 * Heading level mapping
 */
const HEADING_LEVELS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
  H5: HeadingLevel.HEADING_5,
  H6: HeadingLevel.HEADING_6,
};

/**
 * Parse inline content and return TextRuns
 */
function parseInlineContent(element: Element): TextRun[] {
  const runs: TextRun[] = [];

  const processNode = (node: Node, formatting: { bold?: boolean; italics?: boolean; strike?: boolean }) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) {
        runs.push(
          new TextRun({
            text,
            bold: formatting.bold,
            italics: formatting.italics,
            strike: formatting.strike,
          })
        );
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toUpperCase();

      let newFormatting = { ...formatting };

      if (tagName === "STRONG" || tagName === "B") {
        newFormatting.bold = true;
      } else if (tagName === "EM" || tagName === "I") {
        newFormatting.italics = true;
      } else if (tagName === "S" || tagName === "DEL" || tagName === "STRIKE") {
        newFormatting.strike = true;
      } else if (tagName === "CODE") {
        // Inline code - render with monospace font indication
        runs.push(
          new TextRun({
            text: el.textContent || "",
            font: "Courier New",
            ...formatting,
          })
        );
        return;
      } else if (tagName === "A") {
        // Links - just use the text for now (hyperlinks are complex in docx)
        runs.push(
          new TextRun({
            text: el.textContent || "",
            underline: {},
            color: "0000FF",
            ...formatting,
          })
        );
        return;
      } else if (tagName === "BR") {
        runs.push(new TextRun({ text: "", break: 1 }));
        return;
      }

      el.childNodes.forEach((child) => processNode(child, newFormatting));
    }
  };

  element.childNodes.forEach((child) => processNode(child, {}));

  return runs.length > 0 ? runs : [new TextRun("")];
}

/**
 * Parse a table element into docx Table
 */
function parseTable(tableEl: Element): Table {
  const rows: TableRow[] = [];

  const tableRows = tableEl.querySelectorAll("tr");
  tableRows.forEach((tr) => {
    const cells: TableCell[] = [];
    const tableCells = tr.querySelectorAll("th, td");

    tableCells.forEach((cell) => {
      const isHeader = cell.tagName.toUpperCase() === "TH";
      const runs = parseInlineContent(cell);

      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              children: runs,
              alignment: AlignmentType.LEFT,
            }),
          ],
          shading: isHeader ? { fill: "F5F5F5" } : undefined,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
          },
        })
      );
    });

    rows.push(new TableRow({ children: cells }));
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/**
 * Parse an HTML element and return docx elements
 */
function parseElement(element: Element): (Paragraph | Table)[] {
  const results: (Paragraph | Table)[] = [];
  const tagName = element.tagName.toUpperCase();

  // Headings
  if (tagName.match(/^H[1-6]$/)) {
    const level = HEADING_LEVELS[tagName];
    const runs = parseInlineContent(element);
    results.push(
      new Paragraph({
        children: runs,
        heading: level,
        spacing: { before: 240, after: 120 },
      })
    );
  }
  // Paragraphs
  else if (tagName === "P") {
    const runs = parseInlineContent(element);
    results.push(
      new Paragraph({
        children: runs,
        spacing: { after: 200 },
      })
    );
  }
  // Code blocks
  else if (tagName === "PRE") {
    const codeEl = element.querySelector("code");
    const text = codeEl?.textContent || element.textContent || "";

    // Split by lines and create paragraph for each
    const lines = text.split("\n");
    lines.forEach((line) => {
      results.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line || " ", // Empty lines need a space
              font: "Courier New",
              size: 20, // 10pt
            }),
          ],
          shading: { fill: "F5F5F5" },
          spacing: { before: 0, after: 0, line: 240 },
        })
      );
    });
  }
  // Blockquotes
  else if (tagName === "BLOCKQUOTE") {
    // Process children
    element.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childResults = parseElement(child as Element);
        childResults.forEach((para) => {
          if (para instanceof Paragraph) {
            // Add indent for blockquote effect
            results.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: (child as Element).textContent || "",
                    italics: true,
                    color: "666666",
                  }),
                ],
                indent: { left: 720 }, // 0.5 inch
                spacing: { after: 200 },
              })
            );
          }
        });
      }
    });
  }
  // Unordered lists
  else if (tagName === "UL") {
    const items = element.querySelectorAll(":scope > li");
    items.forEach((li) => {
      const runs = parseInlineContent(li);
      results.push(
        new Paragraph({
          children: [new TextRun("• "), ...runs],
          indent: { left: 360 },
          spacing: { after: 100 },
        })
      );
    });
  }
  // Ordered lists
  else if (tagName === "OL") {
    const items = element.querySelectorAll(":scope > li");
    items.forEach((li, index) => {
      const runs = parseInlineContent(li);
      results.push(
        new Paragraph({
          children: [new TextRun(`${index + 1}. `), ...runs],
          indent: { left: 360 },
          spacing: { after: 100 },
        })
      );
    });
  }
  // Tables
  else if (tagName === "TABLE") {
    results.push(parseTable(element));
  }
  // Horizontal rule
  else if (tagName === "HR") {
    results.push(
      new Paragraph({
        children: [new TextRun("———")],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
      })
    );
  }
  // Task lists (checkbox lists)
  else if (tagName === "UL" && element.classList.contains("contains-task-list")) {
    const items = element.querySelectorAll(":scope > li");
    items.forEach((li) => {
      const checkbox = li.querySelector('input[type="checkbox"]');
      const checked = checkbox?.hasAttribute("checked");
      const symbol = checked ? "☑" : "☐";
      const runs = parseInlineContent(li);
      results.push(
        new Paragraph({
          children: [new TextRun(`${symbol} `), ...runs],
          indent: { left: 360 },
          spacing: { after: 100 },
        })
      );
    });
  }
  // Divs and other containers - process children
  else if (tagName === "DIV" || tagName === "SECTION" || tagName === "ARTICLE") {
    element.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) {
        results.push(...parseElement(child as Element));
      }
    });
  }

  return results;
}

/**
 * Convert HTML content to docx Document
 */
export function htmlToDocx(
  html: string,
  options: DocxExportOptions = DEFAULT_DOCX_OPTIONS
): Document {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const children: (Paragraph | Table)[] = [];

  // Process body content
  doc.body.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      children.push(...parseElement(node as Element));
    }
  });

  // Ensure at least one paragraph
  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun("")] }));
  }

  const dimensions = PAGE_DIMENSIONS[options.pageSize];

  const sectionOptions: ISectionOptions = {
    properties: {
      page: {
        size: {
          width: dimensions.width,
          height: dimensions.height,
        },
        margin: {
          top: options.margins.top,
          bottom: options.margins.bottom,
          left: options.margins.left,
          right: options.margins.right,
        },
      },
    },
    children,
  };

  return new Document({
    sections: [sectionOptions],
  });
}

/**
 * Export HTML content to DOCX blob
 */
export async function exportToDocx(
  content: HTMLElement,
  options: DocxExportOptions = DEFAULT_DOCX_OPTIONS
): Promise<Blob> {
  const html = content.innerHTML;
  const document = htmlToDocx(html, options);
  return await Packer.toBlob(document);
}

/**
 * Download the DOCX file
 */
export function downloadDocx(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export content to DOCX and trigger download
 */
export async function exportAndDownloadDocx(
  content: HTMLElement,
  sourceFilename: string,
  options: DocxExportOptions = DEFAULT_DOCX_OPTIONS
): Promise<void> {
  const blob = await exportToDocx(content, options);
  const filename = generateDocxFilename(sourceFilename);
  downloadDocx(blob, filename);
}
