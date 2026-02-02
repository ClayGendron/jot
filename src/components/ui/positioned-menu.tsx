/**
 * Positioned Menu Components
 *
 * UI primitives for cursor-positioned context menus.
 * Styled to match shadcn/ui aesthetic with Tailwind utilities.
 *
 * Use with usePositionedMenu hook for behavior.
 */

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface PositionedMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Screen coordinates to position the menu */
  position: { x: number; y: number };
  /** Estimated menu width for viewport adjustment (default: 200) */
  menuWidth?: number;
  /** Estimated menu height for viewport adjustment (default: 300) */
  menuHeight?: number;
}

/**
 * Container for positioned context menus
 */
export const PositionedMenu = forwardRef<HTMLDivElement, PositionedMenuProps>(
  (
    { position, menuWidth = 200, menuHeight = 300, className, children, ...props },
    ref
  ) => {
    // Adjust position to keep menu visible on screen
    const adjusted = {
      x: Math.min(position.x, window.innerWidth - menuWidth),
      y: Math.min(position.y, window.innerHeight - menuHeight),
    };

    return (
      <div
        ref={ref}
        role="menu"
        className={cn(
          // Base styles
          "fixed z-50 min-w-40 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg",
          // Animation
          "animate-in fade-in-0 zoom-in-95 duration-100",
          className
        )}
        style={{ left: adjusted.x, top: adjusted.y }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
PositionedMenu.displayName = "PositionedMenu";

interface PositionedMenuItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Show destructive styling */
  variant?: "default" | "destructive";
}

/**
 * Clickable menu item
 */
export const PositionedMenuItem = forwardRef<
  HTMLButtonElement,
  PositionedMenuItemProps
>(({ className, variant = "default", children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    role="menuitem"
    className={cn(
      // Base styles
      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none",
      // Hover/focus states
      "hover:bg-accent hover:text-accent-foreground",
      "focus:bg-accent focus:text-accent-foreground",
      // Disabled state
      "disabled:pointer-events-none disabled:opacity-50",
      // Variant styles
      variant === "destructive" && "text-destructive hover:text-destructive",
      className
    )}
    {...props}
  >
    {children}
  </button>
));
PositionedMenuItem.displayName = "PositionedMenuItem";

/**
 * Visual separator between menu sections
 */
export function PositionedMenuSeparator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

/**
 * Header/label for a menu section
 */
export function PositionedMenuHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Text shown when no suggestions available
 */
export function PositionedMenuEmpty({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-2 py-3 text-center text-sm text-muted-foreground", className)}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Feedback message (e.g., "Added to dictionary")
 */
export function PositionedMenuFeedback({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-2 py-3 text-sm text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
