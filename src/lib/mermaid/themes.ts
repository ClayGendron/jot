/**
 * Mermaid Theme Configuration
 *
 * Maps Jot app themes to Mermaid theme configurations.
 * Ensures diagrams visually match the app's light/dark mode.
 */

export type AppTheme = "light" | "dark" | "system";

/**
 * Resolve the effective theme based on app setting and system preference
 */
export function resolveTheme(appTheme: AppTheme): "light" | "dark" {
  if (appTheme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return appTheme;
}

/**
 * Get the Mermaid theme name for the current app theme
 */
export function getMermaidTheme(appTheme: AppTheme): "default" | "dark" {
  const effectiveTheme = resolveTheme(appTheme);
  return effectiveTheme === "dark" ? "dark" : "default";
}
