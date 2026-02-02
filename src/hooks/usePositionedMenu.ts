/**
 * usePositionedMenu Hook
 *
 * Shared behavior for cursor-positioned menus (context menus).
 * Handles click-outside detection and escape key dismissal.
 */

import { useEffect, useRef } from "react";

interface UsePositionedMenuOptions {
  /** Callback when menu should be dismissed */
  onDismiss: () => void;
}

/**
 * Hook for positioned menu behavior
 *
 * @returns ref to attach to the menu container element
 */
export function usePositionedMenu({ onDismiss }: UsePositionedMenuOptions) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Memoize the dismiss callback to prevent effect re-runs
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        dismissRef.current();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dismissRef.current();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return menuRef;
}
