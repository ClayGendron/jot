import { useCallback, DragEvent, MouseEvent } from "react";
import { File, X, Pin } from "lucide-react";
import type { Tab as TabType } from "@/stores/tabsStore";

interface TabProps {
  tab: TabType;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onContextMenu: (e: MouseEvent) => void;
  isDragging?: boolean;
  dragOverPosition?: "left" | "right" | null;
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
}

export function Tab({
  tab,
  isActive,
  onSelect,
  onClose,
  onContextMenu,
  isDragging,
  dragOverPosition,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
}: TabProps) {
  const handleClick = useCallback(() => {
    onSelect();
  }, [onSelect]);

  const handleMiddleClick = useCallback(
    (e: MouseEvent) => {
      // Middle mouse button
      if (e.button === 1 && !tab.isPinned) {
        e.preventDefault();
        onClose();
      }
    },
    [onClose, tab.isPinned]
  );

  const handleCloseClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      onClose();
    },
    [onClose]
  );

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      onContextMenu(e);
    },
    [onContextMenu]
  );

  const classNames = [
    "tab",
    isActive && "active",
    tab.isPinned && "pinned",
    isDragging && "dragging",
    dragOverPosition === "left" && "drag-over-left",
    dragOverPosition === "right" && "drag-over-right",
  ]
    .filter(Boolean)
    .join(" ");

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect();
      }
    },
    [onSelect]
  );

  return (
    <div
      role="tab"
      tabIndex={0}
      className={classNames}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onAuxClick={handleMiddleClick}
      onContextMenu={handleContextMenu}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      title={tab.filePath}
      aria-selected={isActive}
      data-testid={`tab-${tab.id}`}
    >
      {/* Drop indicator - left */}
      {dragOverPosition === "left" && <span className="tab-drop-indicator left" />}

      {/* Pin indicator */}
      {tab.isPinned && (
        <span className="tab-pin-indicator">
          <Pin className="h-2.5 w-2.5" />
        </span>
      )}

      {/* File icon */}
      <span className="tab-icon">
        <File className="h-3.5 w-3.5" />
      </span>

      {/* File name */}
      <span className="tab-name">{tab.displayName}</span>

      {/* Dirty indicator - replaces close button when dirty */}
      {tab.isDirty ? (
        <span className="tab-dirty-indicator" title="Unsaved changes" />
      ) : !tab.isPinned ? (
        <button
          type="button"
          className="tab-close"
          onClick={handleCloseClick}
          title="Close"
          data-testid={`tab-close-${tab.id}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}

      {/* Drop indicator - right */}
      {dragOverPosition === "right" && <span className="tab-drop-indicator right" />}
    </div>
  );
}
