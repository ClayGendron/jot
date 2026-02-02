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
import { X, Download, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close export panel"
          >
            <X className="size-5" />
          </Button>
        </header>

        <div className="export-panel-content">
          {/* Format Selection */}
          <section className="export-section">
            <h3 className="export-section-title">Format</h3>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                active={format === "pdf"}
                onClick={() => setFormat("pdf")}
                className="flex-col h-auto py-4 gap-2"
              >
                <PdfIcon />
                <span>PDF</span>
              </Button>
              <Button
                variant="outline"
                active={format === "docx"}
                onClick={() => setFormat("docx")}
                className="flex-col h-auto py-4 gap-2"
              >
                <DocxIcon />
                <span>Word</span>
              </Button>
            </div>
          </section>

          {/* Page Settings */}
          <section className="export-section">
            <h3 className="export-section-title">Page</h3>

            {/* Page Size */}
            <div className="export-row">
              <label className="export-label">Size</label>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  active={pageSize === "letter"}
                  onClick={() => setPageSize("letter")}
                  className="flex-1"
                >
                  Letter
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  active={pageSize === "a4"}
                  onClick={() => setPageSize("a4")}
                  className="flex-1"
                >
                  A4
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  active={pageSize === "legal"}
                  onClick={() => setPageSize("legal")}
                  className="flex-1"
                >
                  Legal
                </Button>
              </div>
            </div>

            {/* Orientation (PDF only) */}
            {format === "pdf" && (
              <div className="export-row">
                <label className="export-label">Orientation</label>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    active={orientation === "portrait"}
                    onClick={() => setOrientation("portrait")}
                    className="flex-1"
                  >
                    <OrientationPortraitIcon />
                    <span>Portrait</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    active={orientation === "landscape"}
                    onClick={() => setOrientation("landscape")}
                    className="flex-1"
                  >
                    <OrientationLandscapeIcon />
                    <span>Landscape</span>
                  </Button>
                </div>
              </div>
            )}
          </section>

          {/* Margins */}
          <section className="export-section">
            <h3 className="export-section-title">Margins</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground w-12">Top</label>
                <Input
                  type="number"
                  value={margins.top}
                  onChange={(e) =>
                    handleMarginChange("top", parseFloat(e.target.value) || 0.5)
                  }
                  min="0.25"
                  max="2"
                  step="0.25"
                  className="w-16 text-right font-mono"
                />
                <span className="text-xs text-muted-foreground">in</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground w-12">Bottom</label>
                <Input
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
                  className="w-16 text-right font-mono"
                />
                <span className="text-xs text-muted-foreground">in</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground w-12">Left</label>
                <Input
                  type="number"
                  value={margins.left}
                  onChange={(e) =>
                    handleMarginChange("left", parseFloat(e.target.value) || 0.5)
                  }
                  min="0.25"
                  max="2"
                  step="0.25"
                  className="w-16 text-right font-mono"
                />
                <span className="text-xs text-muted-foreground">in</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground w-12">Right</label>
                <Input
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
                  className="w-16 text-right font-mono"
                />
                <span className="text-xs text-muted-foreground">in</span>
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
                <Switch
                  checked={includeBookmarks}
                  onCheckedChange={setIncludeBookmarks}
                />
              </div>
            </section>
          )}

          {/* Error Message */}
          {error && (
            <div className="export-error">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Export Button */}
        <footer className="export-panel-footer">
          <Button
            size="lg"
            className="w-full"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="size-4" />
                <span>Export {format.toUpperCase()}</span>
              </>
            )}
          </Button>
        </footer>
      </aside>
    </div>
  );
}

// Custom Icons - kept for unique document type designs

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

