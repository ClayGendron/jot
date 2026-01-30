import { useCallback, useEffect, useRef, useState } from "react";

export interface ResizeHandleProps {
  /** Current width value */
  width: number;
  /** Minimum width constraint */
  minWidth?: number;
  /** Maximum width constraint */
  maxWidth?: number;
  /** Callback when width changes during drag */
  onResize: (width: number) => void;
  /** Callback when drag ends (for persisting) */
  onResizeEnd?: (width: number) => void;
  /** Position of the resize handle */
  position?: "left" | "right";
  /** Whether the handle is disabled */
  disabled?: boolean;
}

/**
 * Vertical resize handle for panel resizing
 *
 * Drag to resize adjacent panels. Handles mouse events
 * for smooth resizing with bounds constraints.
 */
export function ResizeHandle({
  width,
  minWidth = 180,
  maxWidth = 500,
  onResize,
  onResizeEnd,
  position = "right",
  disabled = false,
}: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;

      e.preventDefault();
      setIsDragging(true);
      startXRef.current = e.clientX;
      startWidthRef.current = width;

      // Add dragging class to body for cursor
      document.body.classList.add("resize-dragging");
    },
    [disabled, width]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta =
        position === "right"
          ? e.clientX - startXRef.current
          : startXRef.current - e.clientX;

      const newWidth = Math.min(
        maxWidth,
        Math.max(minWidth, startWidthRef.current + delta)
      );

      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.classList.remove("resize-dragging");

      // Calculate final width for persistence
      const currentWidth = document.querySelector(".sidebar")?.clientWidth;
      if (currentWidth && onResizeEnd) {
        onResizeEnd(currentWidth);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, minWidth, maxWidth, onResize, onResizeEnd, position]);

  return (
    <div
      className={`resize-handle resize-handle-${position} ${isDragging ? "dragging" : ""} ${disabled ? "disabled" : ""}`}
      onMouseDown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      tabIndex={disabled ? -1 : 0}
    >
      <div className="resize-handle-indicator" />
    </div>
  );
}

export default ResizeHandle;
