import { Editor } from "@/components/editor/Editor";
import { useEditorStore } from "@/stores/editorStore";
import "./index.css";

/**
 * Main application component
 *
 * For now, renders just the editor. Will add:
 * - Sidebar with file tree and outline
 * - Status bar
 * - Settings panel
 */
function App() {
  const { sidebarOpen, toggleSidebar, isDirty, filePath } = useEditorStore();

  return (
    <div className="app-layout">
      {/* Sidebar - placeholder for file tree */}
      <aside className={`sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div style={{ padding: "1rem" }}>
          <h2
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.875rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--color-ink-muted)",
              marginBottom: "1rem",
            }}
          >
            Files
          </h2>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "0.875rem",
              color: "var(--color-ink-muted)",
            }}
          >
            File tree coming soon...
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Title bar with document info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 1rem",
            borderBottom: "1px solid var(--color-border)",
            fontFamily: "var(--font-sans)",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              onClick={toggleSidebar}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "0.25rem",
                color: "var(--color-ink-light)",
              }}
              title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
            <span style={{ color: "var(--color-ink-light)" }}>
              {filePath || "Untitled"}
              {isDirty && (
                <span style={{ color: "var(--color-accent)" }}> •</span>
              )}
            </span>
          </div>
        </div>

        {/* Editor */}
        <Editor placeholder="Start writing..." />
      </main>
    </div>
  );
}

export default App;
