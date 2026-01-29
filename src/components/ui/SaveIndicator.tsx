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
      className={`save-indicator ${saveStatus !== "idle" ? `save-indicator--${saveStatus}` : ""}`}
      role="status"
      aria-live="polite"
    >
      {saveStatus === "saving" && (
        <span className="save-indicator-content">
          <span className="save-indicator-dot" />
          <span className="save-indicator-text">saving</span>
        </span>
      )}
      {saveStatus === "saved" && (
        <span className="save-indicator-content save-indicator-content--reveal">
          <SavedMark />
          <span className="save-indicator-text">saved</span>
        </span>
      )}
      {saveStatus === "error" && (
        <span className="save-indicator-content save-indicator-content--error">
          <ErrorMark />
          <span className="save-indicator-text">
            {saveError || "Save failed"}
          </span>
        </span>
      )}
      {saveStatus === "idle" && lastSaved && (
        <span className="save-indicator-content save-indicator-content--idle">
          <span className="save-indicator-time">
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
