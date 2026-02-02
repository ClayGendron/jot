import { cn } from "@/lib/utils";
import { useEditorStore } from "@/stores/editorStore";

/**
 * Save status indicator component
 *
 * Design: Editorial "margin note" aesthetic - subtle, typographic,
 * feels like a printer's mark on quality paper
 *
 * Shows:
 * - Nothing when idle
 * - "saving..." with subtle pulse when saving
 * - "saved" with gentle fade-in checkmark
 * - Error state with muted warning
 */
export function SaveIndicator() {
  // Use individual selectors to avoid React 19 + Zustand issues
  const saveStatus = useEditorStore((state) => state.saveStatus);
  const saveError = useEditorStore((state) => state.saveError);
  const lastSaved = useEditorStore((state) => state.lastSaved);

  if (saveStatus === "idle" && !lastSaved) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center ml-3 font-serif text-[0.6875rem] italic tracking-wide text-[var(--color-ink-muted)] opacity-70",
        saveStatus === "saving" && "opacity-100",
        saveStatus === "saved" && "opacity-100",
        saveStatus === "error" && "opacity-100"
      )}
      role="status"
      aria-live="polite"
    >
      {saveStatus === "saving" && (
        <span className="inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ink-muted)] animate-pulse" />
          <span className="lowercase">saving</span>
        </span>
      )}
      {saveStatus === "saved" && (
        <span className="inline-flex items-center gap-1.5 animate-in fade-in-0 slide-in-from-bottom-1">
          <SavedMark />
          <span className="lowercase">saved</span>
        </span>
      )}
      {saveStatus === "error" && (
        <span className="inline-flex items-center gap-1.5 text-[var(--color-accent)]">
          <ErrorMark />
          <span className="lowercase">
            {saveError || "Save failed"}
          </span>
        </span>
      )}
      {saveStatus === "idle" && lastSaved && (
        <span className="inline-flex items-center gap-1.5 opacity-50 hover:opacity-80 transition-opacity">
          <span className="not-italic tabular-nums">
            {formatLastSaved(lastSaved)}
          </span>
        </span>
      )}
    </span>
  );
}

/**
 * Format last saved time as relative or absolute
 */
function formatLastSaved(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Saved checkmark - styled as a calligraphic flourish
 */
function SavedMark() {
  return (
    <svg
      className="save-indicator-icon save-indicator-icon--check"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M4 12.5L9.5 18L20 6"
        className="save-indicator-check-path"
      />
    </svg>
  );
}

/**
 * Error mark - subtle exclamation
 */
function ErrorMark() {
  return (
    <svg
      className="save-indicator-icon save-indicator-icon--error"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="8" x2="12" y2="13" />
      <circle cx="12" cy="17" r="0.5" fill="currentColor" />
    </svg>
  );
}

export default SaveIndicator;
