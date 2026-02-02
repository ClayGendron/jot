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
import { Download, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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
  /** Whether the panel is open */
  isOpen: boolean;
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
  isOpen,
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
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={true}
        className="w-[380px] max-w-full p-0 flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-border">
          <SheetTitle className="font-serif text-xl font-semibold tracking-tight">
            Export
          </SheetTitle>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-2">
          {/* Format Selection */}
          <Section title="Format">
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
          </Section>

          {/* Page Settings */}
          <Section title="Page">
            {/* Page Size */}
            <Row>
              <Label>Size</Label>
              <Select
                value={pageSize}
                onValueChange={(value) => setPageSize(value as PageSize)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">Letter (8.5" × 11")</SelectItem>
                  <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                  <SelectItem value="legal">Legal (8.5" × 14")</SelectItem>
                </SelectContent>
              </Select>
            </Row>

            {/* Orientation (PDF only) */}
            {format === "pdf" && (
              <Row>
                <Label>Orientation</Label>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    active={orientation === "portrait"}
                    onClick={() => setOrientation("portrait")}
                    className="flex-1 gap-1.5"
                  >
                    <OrientationPortraitIcon />
                    <span>Portrait</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    active={orientation === "landscape"}
                    onClick={() => setOrientation("landscape")}
                    className="flex-1 gap-1.5"
                  >
                    <OrientationLandscapeIcon />
                    <span>Landscape</span>
                  </Button>
                </div>
              </Row>
            )}
          </Section>

          {/* Margins */}
          <Section title="Margins">
            <div className="grid grid-cols-2 gap-3">
              <MarginInput
                label="Top"
                value={margins.top}
                onChange={(v) => handleMarginChange("top", v)}
              />
              <MarginInput
                label="Bottom"
                value={margins.bottom}
                onChange={(v) => handleMarginChange("bottom", v)}
              />
              <MarginInput
                label="Left"
                value={margins.left}
                onChange={(v) => handleMarginChange("left", v)}
              />
              <MarginInput
                label="Right"
                value={margins.right}
                onChange={(v) => handleMarginChange("right", v)}
              />
            </div>
          </Section>

          {/* PDF Options */}
          {format === "pdf" && (
            <Section title="Options">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium text-foreground">
                    Bookmarks
                  </label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Create outline from headings
                  </p>
                </div>
                <Switch
                  checked={includeBookmarks}
                  onCheckedChange={setIncludeBookmarks}
                />
              </div>
            </Section>
          )}

          {/* Error Message */}
          {error && (
            <div className="mx-6 mb-4 p-3 rounded-md bg-destructive/10 text-destructive flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Footer with Export Button */}
        <SheetFooter className="border-t border-border">
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
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Helper Components

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-6 py-3 border-t border-border first:border-t-0">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="mb-3.5 last:mb-0">{children}</div>;
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[13px] font-medium text-foreground mb-2">
      {children}
    </label>
  );
}

function MarginInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground w-12">{label}</label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0.5)}
        min="0.25"
        max="2"
        step="0.25"
        className="w-16 text-right font-mono"
      />
      <span className="text-xs text-muted-foreground">in</span>
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
