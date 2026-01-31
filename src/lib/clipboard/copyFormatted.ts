/**
 * Copy Formatted Functionality
 *
 * Provides functions to copy editor content to clipboard in
 * different formats: HTML (rich text) or Markdown.
 */

import { htmlToMarkdown } from "../markdown/htmlToMarkdown";

/**
 * Copy format options
 */
export type CopyFormat = "formatted" | "markdown";

/**
 * Result of a copy operation
 */
export interface CopyResult {
  success: boolean;
  error?: string;
}

/**
 * Copy HTML content as rich text (formatted)
 *
 * This copies both HTML and plain text to the clipboard,
 * allowing paste targets to choose the appropriate format.
 * Word and Google Docs will use the HTML format.
 *
 * @param html - The HTML content to copy
 * @param plainText - Plain text fallback
 * @returns CopyResult indicating success or failure
 */
export async function copyAsFormatted(
  html: string,
  plainText: string
): Promise<CopyResult> {
  try {
    // Create blobs with the correct MIME types
    const htmlBlob = new Blob([html], { type: "text/html" });
    const textBlob = new Blob([plainText], { type: "text/plain" });

    // Create ClipboardItem with both formats
    const item = new ClipboardItem({
      "text/html": htmlBlob,
      "text/plain": textBlob,
    });

    // Write to clipboard
    await navigator.clipboard.write([item]);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to copy",
    };
  }
}

/**
 * Copy HTML content as Markdown
 *
 * Converts the HTML to Markdown and copies as plain text.
 * This is useful for pasting into markdown-aware editors.
 *
 * @param html - The HTML content to convert and copy
 * @returns CopyResult indicating success or failure
 */
export async function copyAsMarkdown(html: string): Promise<CopyResult> {
  try {
    // Convert HTML to Markdown
    const markdown = htmlToMarkdown(html);

    // Copy as plain text
    await navigator.clipboard.writeText(markdown);

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to copy",
    };
  }
}

/**
 * Copy content using the specified default format
 *
 * @param html - The HTML content
 * @param plainText - Plain text fallback
 * @param format - The format to use
 * @returns CopyResult indicating success or failure
 */
export async function copyWithDefaultFormat(
  html: string,
  plainText: string,
  format: CopyFormat
): Promise<CopyResult> {
  if (format === "markdown") {
    return copyAsMarkdown(html);
  }
  return copyAsFormatted(html, plainText);
}
