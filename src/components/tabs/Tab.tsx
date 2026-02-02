import { useCallback, DragEvent, MouseEvent } from "react";
import { File, X, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
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
      className={cn(
        "relative flex items-center gap-1.5 px-2.5 py-2 border-none bg-transparent text-[var(--color-ink-muted)] font-sans text-xs font-medium cursor-pointer whitespace-nowrap transition-colors duration-150 min-w-0 max-w-[180px]",
        "hover:text-[var(--color-ink-light)] hover:bg-[var(--color-paper-warm)]",
        isActive && "text-[var(--color-ink)] bg-[var(--color-paper-warm)]",
        tab.isPinned && "pl-1.5",
        isDragging && "opacity-50"
      )}
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
      {/* Pin indicator */}
      {tab.isPinned && (
        <span className="flex items-center justify-center flex-shrink-0 text-[var(--color-ink-muted)] opacity-60">
          <Pin className="h-2.5 w-2.5" />
        </span>
      )}

      {/* File icon */}
      <span className="flex items-center justify-center flex-shrink-0 opacity-70">
        <File className="h-3.5 w-3.5" />
      </span>

      {/* File name */}
      <span className="overflow-hidden text-ellipsis whitespace-nowrap">{tab.displayName}</span>

      {/* Dirty indicator - replaces close button when dirty */}
      {tab.isDirty ? (
        <span
          className="flex-shrink-0 w-2 h-2 rounded-full bg-[var(--color-accent)] ml-1"
          title="Unsaved changes"
        />
      ) : !tab.isPinned ? (
        <button
          type="button"
          className="flex items-center justify-center flex-shrink-0 w-[18px] h-[18px] p-0 ml-0.5 border-none rounded-[3px] bg-transparent text-[var(--color-ink-muted)] cursor-pointer opacity-0 transition-all duration-150 group-hover:opacity-100 hover:bg-[var(--color-border)] hover:text-[var(--color-ink)] active:scale-90"
          onClick={handleCloseClick}
          title="Close"
          data-testid={`tab-close-${tab.id}`}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}

      {/* Active tab indicator - bottom border */}
      {isActive && (
        <span className="absolute bottom-[-1px] left-1.5 right-1.5 h-0.5 bg-[var(--color-accent)] rounded-t-sm" />
      )}

      {/* Drag position indicators */}
      {dragOverPosition === "left" && (
        <span className="absolute top-1 bottom-1 left-[-1px] w-0.5 bg-[var(--color-accent)] rounded-sm" />
      )}
      {dragOverPosition === "right" && (
        <span className="absolute top-1 bottom-1 right-[-1px] w-0.5 bg-[var(--color-accent)] rounded-sm" />
      )}
    </div>
  );
}
