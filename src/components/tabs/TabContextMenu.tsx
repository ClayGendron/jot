/**
 * Tab Context Menu Component
 *
 * Right-click context menu for tabs with options to:
 * - Pin/Unpin tab
 * - Close tab
 * - Close other tabs
 * - Close all tabs
 */

import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import {
  PositionedMenu,
  PositionedMenuItem,
  PositionedMenuSeparator,
} from "@/components/ui/positioned-menu";

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
  const menuRef = usePositionedMenu({ onDismiss });

  return (
    <PositionedMenu
      ref={menuRef}
      position={position}
      menuWidth={180}
      menuHeight={200}
      data-testid="tab-context-menu"
    >
      <PositionedMenuItem
        onClick={() => {
          onPin();
          onDismiss();
        }}
      >
        {isPinned ? "Unpin Tab" : "Pin Tab"}
      </PositionedMenuItem>

      <PositionedMenuSeparator />

      <PositionedMenuItem
        onClick={() => {
          onClose();
          onDismiss();
        }}
      >
        Close
      </PositionedMenuItem>

      <PositionedMenuItem
        onClick={() => {
          onCloseOthers();
          onDismiss();
        }}
      >
        Close Others
      </PositionedMenuItem>

      <PositionedMenuItem
        onClick={() => {
          onCloseAll();
          onDismiss();
        }}
      >
        Close All
      </PositionedMenuItem>
    </PositionedMenu>
  );
}
