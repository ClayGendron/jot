import { useCallback, DragEvent, MouseEvent } from "react";
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

function FileIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="12"
      height="12"
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

function PinIcon() {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1"
    >
      <path d="M12 2L12 12M8 6L16 6L14 14L10 14L8 6ZM10 14L10 22M14 14L14 22" />
    </svg>
  );
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
          <PinIcon />
        </span>
      )}

      {/* File icon */}
      <span className="tab-icon">
        <FileIcon />
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
          <CloseIcon />
        </button>
      ) : null}

      {/* Drop indicator - right */}
      {dragOverPosition === "right" && <span className="tab-drop-indicator right" />}
    </div>
  );
}
