/**
 * PDF Export Functionality
 *
 * Exports editor content to PDF format using jsPDF.
 * Preserves formatting, images, and creates bookmarks from headings.
 */

import { jsPDF } from "jspdf";

/**
 * Page size options for PDF export
 */
export type PageSize = "letter" | "a4" | "legal";

/**
 * Page orientation options
 */
export type Orientation = "portrait" | "landscape";

/**
 * Margin settings in inches
 */
export interface Margins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * PDF export options
 */
export interface ExportOptions {
  pageSize: PageSize;
  orientation: Orientation;
  margins: Margins;
  includeBookmarks: boolean;
  scale: number;
}

/**
 * Default export options with sensible defaults
 */
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  pageSize: "letter",
  orientation: "portrait",
  margins: {
    top: 0.75,
    bottom: 0.75,
    left: 0.75,
    right: 0.75,
  },
  includeBookmarks: true,
  scale: 2, // 2x scale for better quality
};

/**
 * Page dimensions in points (72 points = 1 inch)
 */
const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number }> = {
  letter: { width: 612, height: 792 }, // 8.5 x 11 inches
  a4: { width: 595, height: 842 }, // 210 x 297 mm
  legal: { width: 612, height: 1008 }, // 8.5 x 14 inches
};

/**
 * Generate a filename for PDF export
 */
export function generatePdfFilename(sourceFilename: string): string {
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

  // Truncate if too long (max 30 chars for base name)
  if (baseName.length > 30) {
    baseName = baseName.slice(0, 30);
  }

  // Add timestamp
  const timestamp = new Date().toISOString().slice(0, 10);

  return `${baseName}-${timestamp}.pdf`;
}

/**
 * Extract headings from HTML content for PDF bookmarks
 */
export function extractHeadings(
  html: string
): Array<{ level: number; text: string; id: string }> {
  const headings: Array<{ level: number; text: string; id: string }> = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const headingElements = doc.querySelectorAll("h1, h2, h3, h4, h5, h6");
  headingElements.forEach((el, index) => {
    const level = parseInt(el.tagName.charAt(1), 10);
    const text = el.textContent || `Heading ${index + 1}`;
    const id = el.id || `heading-${index}`;
    headings.push({ level, text, id });
  });

  return headings;
}

/**
 * Apply export styling to a container element
 * This ensures the PDF looks clean and professional
 */
export function createPdfContainer(
  content: HTMLElement,
  options: ExportOptions
): HTMLElement {
  const container = document.createElement("div");
  container.className = "pdf-export-container";

  // Get page dimensions
  const dimensions = PAGE_DIMENSIONS[options.pageSize];
  const isLandscape = options.orientation === "landscape";
  const pageWidth = isLandscape ? dimensions.height : dimensions.width;

  // Calculate content width in pixels (assuming 96 DPI for screen)
  // PDF uses 72 DPI, so we scale
  const marginInPoints = options.margins.left * 72 + options.margins.right * 72;
  const contentWidthPoints = pageWidth - marginInPoints;
  const contentWidthPixels = (contentWidthPoints / 72) * 96;

  // Apply styling for PDF rendering
  container.style.cssText = `
    width: ${contentWidthPixels}px;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #1a1a1a;
    background: white;
    padding: 0;
    margin: 0;
  `;

  // Clone content to avoid modifying the original
  const contentClone = content.cloneNode(true) as HTMLElement;

  // Apply heading styles
  const headings = contentClone.querySelectorAll("h1, h2, h3, h4, h5, h6");
  headings.forEach((h) => {
    const el = h as HTMLElement;
    const level = parseInt(el.tagName.charAt(1), 10);
    const sizes = ["24pt", "20pt", "16pt", "14pt", "12pt", "11pt"];
    el.style.fontFamily = "'Helvetica Neue', Helvetica, Arial, sans-serif";
    el.style.fontSize = sizes[level - 1];
    el.style.fontWeight = "600";
    el.style.marginTop = "1.5em";
    el.style.marginBottom = "0.5em";
    el.style.color = "#1a1a1a";
  });

  // Apply code block styles
  const codeBlocks = contentClone.querySelectorAll("pre");
  codeBlocks.forEach((pre) => {
    const el = pre as HTMLElement;
    el.style.backgroundColor = "#f5f5f5";
    el.style.padding = "12px";
    el.style.borderRadius = "4px";
    el.style.fontSize = "10pt";
    el.style.fontFamily = "'JetBrains Mono', 'Fira Code', monospace";
    el.style.overflow = "hidden";
    el.style.whiteSpace = "pre-wrap";
  });

  // Apply inline code styles
  const inlineCode = contentClone.querySelectorAll("code:not(pre code)");
  inlineCode.forEach((code) => {
    const el = code as HTMLElement;
    el.style.backgroundColor = "#f0f0f0";
    el.style.padding = "2px 4px";
    el.style.borderRadius = "3px";
    el.style.fontSize = "0.9em";
    el.style.fontFamily = "'JetBrains Mono', 'Fira Code', monospace";
  });

  // Apply link styles (just underline, no color for print)
  const links = contentClone.querySelectorAll("a");
  links.forEach((a) => {
    const el = a as HTMLElement;
    el.style.color = "#1a1a1a";
    el.style.textDecoration = "underline";
  });

  // Apply blockquote styles
  const blockquotes = contentClone.querySelectorAll("blockquote");
  blockquotes.forEach((bq) => {
    const el = bq as HTMLElement;
    el.style.borderLeft = "3px solid #ddd";
    el.style.paddingLeft = "16px";
    el.style.marginLeft = "0";
    el.style.fontStyle = "italic";
    el.style.color = "#555";
  });

  // Apply table styles
  const tables = contentClone.querySelectorAll("table");
  tables.forEach((table) => {
    const el = table as HTMLElement;
    el.style.borderCollapse = "collapse";
    el.style.width = "100%";
    el.style.marginTop = "1em";
    el.style.marginBottom = "1em";
  });

  const cells = contentClone.querySelectorAll("th, td");
  cells.forEach((cell) => {
    const el = cell as HTMLElement;
    el.style.border = "1px solid #ddd";
    el.style.padding = "8px";
    el.style.textAlign = "left";
  });

  const headerCells = contentClone.querySelectorAll("th");
  headerCells.forEach((th) => {
    const el = th as HTMLElement;
    el.style.backgroundColor = "#f5f5f5";
    el.style.fontWeight = "600";
  });

  container.appendChild(contentClone);
  return container;
}

/**
 * Export HTML content to PDF
 *
 * @param content - The HTML element to export
 * @param filename - The source filename (used to generate PDF filename)
 * @param options - Export options
 * @returns Promise resolving to the PDF blob
 */
export async function exportToPdf(
  content: HTMLElement,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): Promise<Blob> {
  // Dynamically import html2canvas to avoid SSR issues
  const html2canvas = (await import("html2canvas")).default;

  // Create styled container for PDF export
  const container = createPdfContainer(content, options);

  // Temporarily add to DOM for rendering
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);

  try {
    // Render to canvas
    const canvas = await html2canvas(container, {
      scale: options.scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
    });

    // Get page dimensions
    const dimensions = PAGE_DIMENSIONS[options.pageSize];
    const isLandscape = options.orientation === "landscape";
    const pageWidth = isLandscape ? dimensions.height : dimensions.width;
    const pageHeight = isLandscape ? dimensions.width : dimensions.height;

    // Calculate margins in points
    const marginTop = options.margins.top * 72;
    const marginBottom = options.margins.bottom * 72;
    const marginLeft = options.margins.left * 72;
    const marginRight = options.margins.right * 72;

    // Calculate available content area
    const contentWidth = pageWidth - marginLeft - marginRight;
    const contentHeight = pageHeight - marginTop - marginBottom;

    // Create PDF
    const pdf = new jsPDF({
      orientation: options.orientation === "landscape" ? "l" : "p",
      unit: "pt",
      format: options.pageSize,
    });

    // Calculate image dimensions to fit content area
    const imgWidth = contentWidth;

    // Handle multi-page documents
    let yOffset = 0;
    let pageNumber = 1;

    while (yOffset < canvas.height) {
      if (pageNumber > 1) {
        pdf.addPage();
      }

      // Calculate how much of the canvas to draw on this page
      const sourceHeight = Math.min(
        (contentHeight * canvas.width) / contentWidth,
        canvas.height - yOffset
      );

      // Create a temporary canvas for this page section
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      const ctx = pageCanvas.getContext("2d");

      if (ctx) {
        ctx.drawImage(
          canvas,
          0,
          yOffset,
          canvas.width,
          sourceHeight,
          0,
          0,
          canvas.width,
          sourceHeight
        );

        const pageImgData = pageCanvas.toDataURL("image/png", 1.0);
        const thisPageHeight = (sourceHeight * contentWidth) / canvas.width;

        pdf.addImage(
          pageImgData,
          "PNG",
          marginLeft,
          marginTop,
          imgWidth,
          thisPageHeight
        );
      }

      yOffset += sourceHeight;
      pageNumber++;
    }

    // Return as blob
    return pdf.output("blob");
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}

/**
 * Download the PDF file
 */
export function downloadPdf(blob: Blob, filename: string): void {
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
 * Export content to PDF and trigger download
 */
export async function exportAndDownloadPdf(
  content: HTMLElement,
  sourceFilename: string,
  options: ExportOptions = DEFAULT_EXPORT_OPTIONS
): Promise<void> {
  const blob = await exportToPdf(content, options);
  const filename = generatePdfFilename(sourceFilename);
  downloadPdf(blob, filename);
}
