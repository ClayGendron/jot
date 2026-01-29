/**
 * Mermaid Diagram Export Utilities
 *
 * Provides functions to export rendered Mermaid diagrams as SVG or PNG files.
 */

/**
 * Export diagram as SVG blob
 */
export function exportAsSvg(svgContent: string): Blob {
  return new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
}

/**
 * Export diagram as PNG blob
 *
 * @param svgContent - The SVG string to convert
 * @param scale - Resolution multiplier (default 2x for retina displays)
 * @returns Promise resolving to PNG Blob
 */
export async function exportAsPng(
  svgContent: string,
  scale: number = 2
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Create image element
    const img = new Image();
    const svgBlob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Create canvas at scaled resolution
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Fill with white background (diagrams may have transparent areas)
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw scaled image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Convert to blob
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to create PNG blob"));
          }
        },
        "image/png",
        1.0
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load SVG for PNG export"));
    };

    img.src = url;
  });
}

/**
 * Trigger browser download for a blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
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
 * Generate a filename for export based on diagram content
 */
export function generateExportFilename(
  diagramSource: string,
  extension: "svg" | "png"
): string {
  // Extract first line to create a descriptive name
  const firstLine = diagramSource.trim().split("\n")[0] || "diagram";
  // Clean up for filename (remove special chars, limit length)
  const cleanName = firstLine
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 30);

  const baseName = cleanName || "mermaid-diagram";
  const timestamp = new Date().toISOString().slice(0, 10);

  return `${baseName}-${timestamp}.${extension}`;
}
