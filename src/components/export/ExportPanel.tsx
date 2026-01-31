/**
 * Export Panel Component
 *
 * A slide-out panel for exporting documents to PDF or Word formats.
 * Provides options for page size, margins, and format-specific settings.
 *
 * Design: Consistent with SettingsPanel - refined, editorial aesthetic
 * with clean controls and clear visual hierarchy.
 */

import { useState, useCallback } from "react";
import {
  exportAndDownloadPdf,
  type ExportOptions,
  type PageSize,
  type Orientation,
} from "@/lib/export/pdfExport";
import {
  exportAndDownloadDocx,
  type DocxExportOptions,
  type DocxPageSize,
} from "@/lib/export/docxExport";

interface ExportPanelProps {
  /** Content element to export */
  contentRef: React.RefObject<HTMLElement | null>;
  /** Source filename for generating export filename */
  filename: string;
  /** Callback when panel is closed */
  onClose: () => void;
}

type ExportFormat = "pdf" | "docx";

/**
 * Export Panel - provides document export functionality
 */
export function ExportPanel({
  contentRef,
  filename,
  onClose,
}: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [pageSize, setPageSize] = useState<PageSize>("letter");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margins, setMargins] = useState({
    top: 0.75,
    bottom: 0.75,
    left: 0.75,
    right: 0.75,
  });
  const [includeBookmarks, setIncludeBookmarks] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle export
  const handleExport = useCallback(async () => {
    if (!contentRef.current) {
      setError("No content to export");
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      if (format === "pdf") {
        const options: ExportOptions = {
          pageSize,
          orientation,
          margins,
          includeBookmarks,
          scale: 2,
        };
        await exportAndDownloadPdf(contentRef.current, filename, options);
      } else {
        // Convert margins from inches to twips for DOCX
        const docxOptions: DocxExportOptions = {
          pageSize: pageSize as DocxPageSize,
          margins: {
            top: margins.top * 1440,
            bottom: margins.bottom * 1440,
            left: margins.left * 1440,
            right: margins.right * 1440,
          },
        };
        await exportAndDownloadDocx(contentRef.current, filename, docxOptions);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [
    contentRef,
    filename,
    format,
    pageSize,
    orientation,
    margins,
    includeBookmarks,
    onClose,
  ]);

  // Handle margin change
  const handleMarginChange = useCallback(
    (side: "top" | "bottom" | "left" | "right", value: number) => {
      setMargins((prev) => ({
        ...prev,
        [side]: Math.max(0.25, Math.min(2, value)),
      }));
    },
    []
  );

  return (
    <div className="export-panel-overlay" onClick={onClose}>
      <aside
        className="export-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Export document"
      >
        <header className="export-panel-header">
          <h2 className="export-panel-title">Export</h2>
          <button
            className="export-panel-close"
            onClick={onClose}
            aria-label="Close export panel"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="export-panel-content">
          {/* Format Selection */}
          <section className="export-section">
            <h3 className="export-section-title">Format</h3>
            <div className="export-format-buttons">
              <button
                className={`export-format-btn ${format === "pdf" ? "active" : ""}`}
                onClick={() => setFormat("pdf")}
              >
                <PdfIcon />
                <span>PDF</span>
              </button>
              <button
                className={`export-format-btn ${format === "docx" ? "active" : ""}`}
                onClick={() => setFormat("docx")}
              >
                <DocxIcon />
                <span>Word</span>
              </button>
            </div>
          </section>

          {/* Page Settings */}
          <section className="export-section">
            <h3 className="export-section-title">Page</h3>

            {/* Page Size */}
            <div className="export-row">
              <label className="export-label">Size</label>
              <div className="export-select-group">
                <button
                  className={`export-select-btn ${pageSize === "letter" ? "active" : ""}`}
                  onClick={() => setPageSize("letter")}
                >
                  Letter
                </button>
                <button
                  className={`export-select-btn ${pageSize === "a4" ? "active" : ""}`}
                  onClick={() => setPageSize("a4")}
                >
                  A4
                </button>
                <button
                  className={`export-select-btn ${pageSize === "legal" ? "active" : ""}`}
                  onClick={() => setPageSize("legal")}
                >
                  Legal
                </button>
              </div>
            </div>

            {/* Orientation (PDF only) */}
            {format === "pdf" && (
              <div className="export-row">
                <label className="export-label">Orientation</label>
                <div className="export-select-group">
                  <button
                    className={`export-select-btn ${orientation === "portrait" ? "active" : ""}`}
                    onClick={() => setOrientation("portrait")}
                  >
                    <OrientationPortraitIcon />
                    <span>Portrait</span>
                  </button>
                  <button
                    className={`export-select-btn ${orientation === "landscape" ? "active" : ""}`}
                    onClick={() => setOrientation("landscape")}
                  >
                    <OrientationLandscapeIcon />
                    <span>Landscape</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Margins */}
          <section className="export-section">
            <h3 className="export-section-title">Margins</h3>
            <div className="export-margins-grid">
              <div className="export-margin-input">
                <label>Top</label>
                <input
                  type="number"
                  value={margins.top}
                  onChange={(e) =>
                    handleMarginChange("top", parseFloat(e.target.value) || 0.5)
                  }
                  min="0.25"
                  max="2"
                  step="0.25"
                />
                <span className="export-margin-unit">in</span>
              </div>
              <div className="export-margin-input">
                <label>Bottom</label>
                <input
                  type="number"
                  value={margins.bottom}
                  onChange={(e) =>
                    handleMarginChange(
                      "bottom",
                      parseFloat(e.target.value) || 0.5
                    )
                  }
                  min="0.25"
                  max="2"
                  step="0.25"
                />
                <span className="export-margin-unit">in</span>
              </div>
              <div className="export-margin-input">
                <label>Left</label>
                <input
                  type="number"
                  value={margins.left}
                  onChange={(e) =>
                    handleMarginChange("left", parseFloat(e.target.value) || 0.5)
                  }
                  min="0.25"
                  max="2"
                  step="0.25"
                />
                <span className="export-margin-unit">in</span>
              </div>
              <div className="export-margin-input">
                <label>Right</label>
                <input
                  type="number"
                  value={margins.right}
                  onChange={(e) =>
                    handleMarginChange(
                      "right",
                      parseFloat(e.target.value) || 0.5
                    )
                  }
                  min="0.25"
                  max="2"
                  step="0.25"
                />
                <span className="export-margin-unit">in</span>
              </div>
            </div>
          </section>

          {/* PDF Options */}
          {format === "pdf" && (
            <section className="export-section">
              <h3 className="export-section-title">Options</h3>
              <div className="export-row export-toggle-row">
                <div className="export-toggle-info">
                  <label className="export-label">Bookmarks</label>
                  <span className="export-description">
                    Create outline from headings
                  </span>
                </div>
                <button
                  className={`export-toggle ${includeBookmarks ? "active" : ""}`}
                  onClick={() => setIncludeBookmarks(!includeBookmarks)}
                  role="switch"
                  aria-checked={includeBookmarks}
                >
                  <span className="export-toggle-knob" />
                </button>
              </div>
            </section>
          )}

          {/* Error Message */}
          {error && (
            <div className="export-error">
              <ErrorIcon />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Export Button */}
        <footer className="export-panel-footer">
          <button
            className="export-btn-primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <LoadingSpinner />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <DownloadIcon />
                <span>Export {format.toUpperCase()}</span>
              </>
            )}
          </button>
        </footer>
      </aside>
    </div>
  );
}

// Icons

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 15h6" />
      <path d="M9 11h2" />
    </svg>
  );
}

function DocxIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
      <path d="M8 9h1" />
    </svg>
  );
}

function OrientationPortraitIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="3" width="12" height="18" rx="1" />
    </svg>
  );
}

function OrientationLandscapeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="6" width="18" height="12" rx="1" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="export-spinner"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
