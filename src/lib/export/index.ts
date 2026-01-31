/**
 * Export Module
 *
 * Provides functionality for exporting documents to various formats.
 */

export {
  exportToPdf,
  exportAndDownloadPdf,
  downloadPdf,
  generatePdfFilename,
  extractHeadings,
  createPdfContainer,
  DEFAULT_EXPORT_OPTIONS,
  type ExportOptions,
  type PageSize,
  type Orientation,
  type Margins,
} from "./pdfExport";

export {
  exportToDocx,
  exportAndDownloadDocx,
  downloadDocx,
  generateDocxFilename,
  htmlToDocx,
  DEFAULT_DOCX_OPTIONS,
  type DocxExportOptions,
  type DocxPageSize,
  type DocxMargins,
} from "./docxExport";
