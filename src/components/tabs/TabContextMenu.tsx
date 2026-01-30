import { useEffect, useRef } from "react";

interface TabContextMenuProps {
  position: { x: number; y: number };
  isPinned: boolean;
  onPin: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
  onDismiss: () => void;
}

export function TabContextMenu({
  position,
  isPinned,
  onPin,
  onClose,
  onCloseOthers,
  onCloseAll,
  onDismiss,
}: TabContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onDismiss]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onDismiss();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  // Calculate position to keep menu on screen
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 180),
    y: Math.min(position.y, window.innerHeight - 200),
  };

  return (
    <div
      ref={menuRef}
      className="tab-context-menu"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      role="menu"
      data-testid="tab-context-menu"
    >
      <button
        type="button"
        className="tab-context-menu-item"
        onClick={() => {
          onPin();
          onDismiss();
        }}
        role="menuitem"
      >
        {isPinned ? "Unpin Tab" : "Pin Tab"}
      </button>

      <div className="tab-context-menu-divider" />

      <button
        type="button"
        className="tab-context-menu-item"
        onClick={() => {
          onClose();
          onDismiss();
        }}
        role="menuitem"
      >
        Close
      </button>

      <button
        type="button"
        className="tab-context-menu-item"
        onClick={() => {
          onCloseOthers();
          onDismiss();
        }}
        role="menuitem"
      >
        Close Others
      </button>

      <button
        type="button"
        className="tab-context-menu-item"
        onClick={() => {
          onCloseAll();
          onDismiss();
        }}
        role="menuitem"
      >
        Close All
      </button>
    </div>
  );
}
