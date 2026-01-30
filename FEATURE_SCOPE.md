# Jot - Feature Scope & Kanban Board

> A lightweight, fast, cross-platform markdown editor that’s free forever.

---

## Project Overview

### Vision

Jot is a distraction-free markdown editor for writers and note-takers who want speed, simplicity, and powerful features without the complexity. No cloud dependencies, no subscription fees, no vendor lock-in.

### Target User

**Writers & Note-takers** - People who write daily notes, journals, blogs, documentation, and want a fast, beautiful tool that stays out of their way.

### Core Principles

1.  **Fast** - Sub-second startup, instant responsiveness
    
2.  **Local-first** - All data on device, standard .md files
    
3.  **Free forever** - No paid tiers, no cloud lock-in
    
4.  **Beautiful** - Clean UI, great typography, delightful UX
    
5.  **Powerful** - Advanced features accessible through simple UI
    

---

## Technical Architecture

### Stack

| Component | Technology | Rationale |
| --- | --- | --- |
| **Desktop App** | Tauri 2.0 | Rust backend, ~10MB bundle, fast startup, secure |
| **Mobile App** | React Native | iOS App Store ready, native performance, shared logic |
| **Frontend** | React + TypeScript | Shared with Tauri webview, component reuse |
| **Editor Engine** | TipTap | ProseMirror-based, extensible, great WYSIWYG support |
| **Vector Search** | Custom HNSW (Rust) | On-device, stored in `.jot/` directory |
| **Embeddings** | all-MiniLM-L6-v2 | ~30MB model, fast inference, good quality |
| **Spell/Grammar** | LanguageTool | On-device, no cloud, comprehensive rules |
| **Local Database** | SQLite | Version history, settings, metadata |
| **Export Engine** | pdf-lib + docx | Built-in, no external dependencies |

### Data Architecture

```plaintext
workspace/
├── .jot/
│   ├── config.json          # Workspace settings
│   ├── history.db           # SQLite: version history, metadata
│   ├── vectors.hnsw         # HNSW index for semantic search
│   └── embeddings.db        # Cached document embeddings
├── documents/
│   ├── note.md              # Standard markdown files
│   └── ...
└── assets/
    └── images/

```

### File Format

-   **Documents**: Standard `.md` files (pure markdown, no extensions)
    
-   **Metadata**: Stored in `.jot/` directory (never touches user files)
    
-   **Portability**: Files work in any markdown editor
    

---

## Feature Kanban Board

### Priority Levels

-   **P0** - Must have for v1.0 launch
    
-   **P1** - Should have for v1.0, can slip to v1.1
    
-   **P2** - Nice to have, v1.x roadmap
    

### Status Legend

-   🔴 **Backlog** - Not started
    
-   🟡 **In Progress** - Currently being worked on
    
-   🟢 **Done** - Completed and tested
    
-   ⚪ **Blocked** - Waiting on dependency
    

---

## Epic 1: Core Editor

### 1.1 WYSIWYG Markdown Editing

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E1.1.1 | As a user, I can write markdown and see it rendered in real-time | TipTap editor renders markdown as I type; syntax hides when cursor moves away |
| E1.1.2 | As a user, I can toggle between WYSIWYG and raw markdown view | Toggle button/shortcut switches between rendered and source view instantly |
| E1.1.3 | As a user, I can format text using keyboard shortcuts | Cmd/Ctrl+B for bold, Cmd/Ctrl+I for italic, etc. (standard shortcuts) |
| E1.1.4 | As a user, I can see a minimal toolbar for formatting | Floating toolbar with: headings (1-6), bold, italic, strikethrough, highlight, lists (bullet, numbered, checkbox), link, image, code (inline/block), quote, table, horizontal rule |
| E1.1.5 | As a user, I can create and edit tables visually | Click to insert table, drag to resize columns, add/remove rows/columns via context menu |
| E1.1.6 | As a user, I can insert and preview images | Drag-drop, paste from clipboard, or insert via dialog; images render inline |
| E1.1.7 | As a user, I can create internal links to other documents | `[[filename]]` syntax autocompletes, renders as clickable link |
| E1.1.8 | As a user, I can create links to specific headings | `[[filename#heading]]` links to heading within document |

### 1.2 Mermaid Diagram Support

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E1.2.1 | As a user, I can insert mermaid code blocks | ``mermaid `syntax recognized, renders diagram below code |
| E1.2.2 | As a user, I can see rendered diagrams inline | Flowcharts, sequence diagrams, Gantt charts, pie charts render beautifully |
| E1.2.3 | As a user, I can click to edit diagram source | Clicking diagram shows source code for editing |
| E1.2.4 | As a user, I can export diagrams as images | Right-click diagram > Export as PNG/SVG |
| E1.2.5 | As a user, diagrams respect my theme (light/dark) | Mermaid diagrams adapt colors to current theme |

### 1.3 Code Blocks

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E1.3.1 | As a user, I can create fenced code blocks | `` `creates code block, language selector appears |
| E1.3.2 | As a user, I see syntax highlighting for 100+ languages | Popular languages highlighted correctly (JS, Python, Rust, Go, etc.) |
| E1.3.3 | As a user, I can copy code with one click | Copy button appears on hover, copies without formatting |
| E1.3.4 | As a user, I can see line numbers (optional) | Setting to show/hide line numbers in code blocks |

### 1.4 Math/LaTeX Support

**Priority**: P1 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E1.4.1 | As a user, I can write inline math with `$...$` | Single dollar signs render inline math |
| E1.4.2 | As a user, I can write block math with `$...$` | Double dollar signs render centered math block |
| E1.4.3 | As a user, I see beautifully rendered equations | KaTeX rendering with proper typography |

---

## Epic 2: File Management

### 2.1 File Tree Navigation

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E2.1.1 | As a user, I can see all markdown files in my workspace | Left panel shows folder tree, only .md files and folders |
| E2.1.2 | As a user, I can expand/collapse folders | Click chevron or double-click folder to toggle |
| E2.1.3 | As a user, I can create new files/folders | Right-click context menu, keyboard shortcut (Cmd/Ctrl+N) |
| E2.1.4 | As a user, I can rename files with auto-link update | Rename file, all internal links update automatically |
| E2.1.5 | As a user, I can move files via drag-drop | Drag files between folders, links update |
| E2.1.6 | As a user, I can delete files with confirmation | Delete moves to trash, confirmation dialog |
| E2.1.7 | As a user, I can sort files by name/date | Sort dropdown in file tree header |

### 2.2 Document Outline

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E2.2.1 | As a user, I can see document outline based on headings | Collapsible outline panel showing H1-H6 hierarchy |
| E2.2.2 | As a user, I can click outline item to navigate | Click heading in outline, editor scrolls to that section |
| E2.2.3 | As a user, I can see current position highlighted | Current section highlighted in outline as I scroll |
| E2.2.4 | As a user, I can filter outline by search | Search box in outline panel filters headings |

### 2.3 Workspace Management

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E2.3.1 | As a user, I can open a folder as workspace | File > Open Folder, folder becomes workspace |
| E2.3.2 | As a user, I can set a default startup workspace | Settings option to always open specific folder on launch |
| E2.3.3 | As a user, I can access recent workspaces quickly | File > Recent Workspaces, keyboard shortcut list |
| E2.3.4 | As a user, I can switch workspaces without restart | Open new workspace in new window or replace current |
| E2.3.5 | As a user, workspace settings are saved per-folder | `.jot/config.json` stores workspace-specific settings |

---

## Epic 3: Autosave & Version History

### 3.1 Automatic Saving

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E3.1.1 | As a user, my changes are saved automatically | Save after 1 second of inactivity, no manual save needed |
| E3.1.2 | As a user, I see a save indicator | Subtle indicator showing “Saved” or “Saving…” |
| E3.1.3 | As a user, I can manually save with Cmd/Ctrl+S | Shortcut triggers immediate save |
| E3.1.4 | As a user, unsaved changes are preserved on crash | On crash, content recovered from autosave on next launch |

### 3.2 Version History

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E3.2.1 | As a user, I can view version history for any file | Right-click > Version History, or View menu |
| E3.2.2 | As a user, I can see timestamped snapshots | List shows date/time, optionally content preview |
| E3.2.3 | As a user, I can restore any previous version | Click restore, current content replaced (with confirmation) |
| E3.2.4 | As a user, I can compare versions side-by-side | Diff view showing changes between versions |
| E3.2.5 | As a user, versions are stored efficiently | SQLite stores diffs, not full copies; configurable retention |

### 3.3 External Change Detection

**Priority**: P1 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E3.3.1 | As a user, I’m notified when file changes externally | Banner appears: “File changed on disk. Reload?” |
| E3.3.2 | As a user, I can reload or keep my version | Buttons to reload (lose changes) or keep (overwrite on save) |
| E3.3.3 | As a user, I can see a diff of external changes | “View changes” button shows what changed externally |

---

## Epic 4: Search

### 4.1 Keyword Search

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E4.1.1 | As a user, I can search within current document | Cmd/Ctrl+F opens search bar, highlights matches |
| E4.1.2 | As a user, I can find and replace in document | Replace input with Replace/Replace All buttons |
| E4.1.3 | As a user, I can search across all files in workspace | Cmd/Ctrl+Shift+F opens global search |
| E4.1.4 | As a user, I see search results with context | Results show file name, line, surrounding text |
| E4.1.5 | As a user, I can filter search by file path/type | Filters for folder, file name pattern |
| E4.1.6 | As a user, I can use regex in search | Toggle for regex mode |

### 4.2 Semantic Search (Vector)

**Priority**: P0 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E4.2.1 | As a user, I can opt-in to semantic search | First-time prompt explaining feature, downloads model |
| E4.2.2 | As a user, I can search by meaning not just keywords | “What did I write about productivity?” finds relevant notes |
| E4.2.3 | As a user, documents are indexed automatically | Background indexing on save, progress indicator |
| E4.2.4 | As a user, I can see “related documents” for current file | Panel/button showing semantically similar notes |
| E4.2.5 | As a user, all processing happens on-device | No network requests, embeddings stored in `.jot/` |
| E4.2.6 | As a user, I can rebuild the index if needed | Settings option to reindex all documents |

---

## Epic 5: Spell Check & Grammar

### 5.1 Spell Checking

**Priority**: P0 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E5.1.1 | As a user, misspelled words are underlined | Red squiggly underline on misspelled words |
| E5.1.2 | As a user, I can right-click for suggestions | Context menu shows spelling suggestions |
| E5.1.3 | As a user, I can add words to personal dictionary | “Add to dictionary” option in context menu |
| E5.1.4 | As a user, I can change spell check language | Settings to select language(s) |
| E5.1.5 | As a user, spell check ignores code blocks | Code blocks not spell-checked |

### 5.2 Grammar Checking

**Priority**: P0 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E5.2.1 | As a user, grammar issues are highlighted | Blue/green underline for grammar problems |
| E5.2.2 | As a user, I see explanations for grammar issues | Hover/click shows explanation and suggestion |
| E5.2.3 | As a user, I can accept or ignore suggestions | Quick-fix buttons in hover panel |
| E5.2.4 | As a user, grammar check runs on-device | LanguageTool runs locally, no cloud |
| E5.2.5 | As a user, I can disable grammar check if desired | Toggle in settings |

---

## Epic 6: Export

### 6.1 PDF Export

**Priority**: P0 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E6.1.1 | As a user, I can export document to PDF | File > Export > PDF, or right-click menu |
| E6.1.2 | As a user, PDF preserves formatting and images | WYSIWYG output matches editor appearance |
| E6.1.3 | As a user, I can customize PDF margins/size | Export dialog with paper size, margins options |
| E6.1.4 | As a user, PDF includes clickable links | Internal and external links work in PDF |
| E6.1.5 | As a user, PDF has bookmarks from headings | PDF outline matches document headings |
| E6.1.6 | As a user, no external dependencies required | pdf-lib bundled, works offline |

### 6.2 Word/DOCX Export

**Priority**: P0 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E6.2.1 | As a user, I can export to Word format | File > Export > Word (.docx) |
| E6.2.2 | As a user, Word doc preserves formatting | Headings, lists, tables, images converted properly |
| E6.2.3 | As a user, Word doc is editable in MS Word/Google Docs | Opens correctly in Word and Google Docs |
| E6.2.4 | As a user, no external dependencies required | docx library bundled, works offline |

### 6.3 HTML Export

**Priority**: P1 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E6.3.1 | As a user, I can export to HTML | File > Export > HTML |
| E6.3.2 | As a user, I can choose standalone or plain HTML | Option for styled (includes CSS) or plain HTML |
| E6.3.3 | As a user, HTML includes embedded images | Images embedded as base64 or relative paths |

### 6.4 Copy Formatted

**Priority**: P0 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E6.4.1 | As a user, I can copy as rich text | Right-click > Copy as Formatted, pastes into Word/Docs with formatting |
| E6.4.2 | As a user, I can copy as raw markdown | Right-click > Copy as Markdown, pastes plain text |
| E6.4.3 | As a user, default copy behavior is configurable | Setting to choose default copy format |

---

## Epic 7: Customization

### 7.1 Themes & Appearance

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E7.1.1 | As a user, I can switch between light and dark mode | Toggle in toolbar, respects system preference by default |
| E7.1.2 | As a user, I can choose from built-in themes | 5+ themes: Default Light/Dark, Sepia, High Contrast, etc. |
| E7.1.3 | As a user, I can customize accent colors | Color picker for accent/highlight colors |
| E7.1.4 | As a user, theme applies to editor and UI | Consistent theming across entire app |

### 7.2 Typography

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E7.2.1 | As a user, I can change editor font family | Dropdown with bundled fonts + system fonts |
| E7.2.2 | As a user, I can change font size | Slider or input, Cmd/Ctrl+Plus/Minus shortcuts |
| E7.2.3 | As a user, I can adjust line height | Slider for line spacing |
| E7.2.4 | As a user, I can set maximum line width | Readable line width toggle with customizable max |
| E7.2.5 | As a user, fonts are bundled (no internet required) | 3-5 quality fonts included (Inter, JetBrains Mono, etc.) |

### 7.3 Editor Preferences

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E7.3.1 | As a user, I can enable/disable focus mode | Focus mode highlights current paragraph only |
| E7.3.2 | As a user, I can enable/disable typewriter mode | Keeps current line vertically centered |
| E7.3.3 | As a user, I can toggle line numbers | Show/hide line numbers in editor |
| E7.3.4 | As a user, all settings are in a friendly UI | Settings panel with clear sections, no config files |

### 7.4 Keyboard Shortcuts

**Priority**: P1 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E7.4.1 | As a user, I can view all keyboard shortcuts | Help > Keyboard Shortcuts shows searchable list |
| E7.4.2 | As a user, I can customize shortcuts | Click to rebind any shortcut |
| E7.4.3 | As a user, I can reset to defaults | Button to restore default shortcuts |

---

## Epic 8: User Interface

### 8.1 Layout & Panels

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E8.1.1 | As a user, I see a clean three-panel layout | Left sidebar (files/outline), center (editor), optional right panel |
| E8.1.2 | As a user, I can collapse/expand sidebar | Toggle button or keyboard shortcut to hide sidebar |
| E8.1.3 | As a user, I can resize panels by dragging | Drag borders to adjust widths |
| E8.1.4 | As a user, I can go fullscreen/zen mode | Cmd/Ctrl+Shift+F or button for distraction-free mode |
| E8.1.5 | As a user, layout state persists across sessions | Panel sizes and visibility remembered |

### 8.2 Tabs & Multi-file

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E8.2.1 | As a user, I can open multiple files in tabs | Double-click file opens in new tab |
| E8.2.2 | As a user, I can reorder tabs by dragging | Drag tabs to rearrange |
| E8.2.3 | As a user, I can close tabs with middle-click or X | Standard tab close behavior |
| E8.2.4 | As a user, I see unsaved indicator on tabs | Dot or icon indicating unsaved changes |
| E8.2.5 | As a user, I can pin tabs | Right-click > Pin, pinned tabs stay left |

### 8.3 Formatting Toolbar

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E8.3.1 | As a user, I see a clean toolbar at top of document | Minimal toolbar with formatting buttons |
| E8.3.2 | As a user, toolbar includes all formatting options | Headings, bold, italic, strikethrough, highlight, lists, link, image, code, quote, table, horizontal rule |
| E8.3.3 | As a user, toolbar shows active formatting | Bold button highlighted when cursor in bold text |
| E8.3.4 | As a user, toolbar includes theme/style access | Quick access to light/dark mode, font settings |

### 8.4 Command Palette

**Priority**: P1 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E8.4.1 | As a user, I can open command palette | Cmd/Ctrl+Shift+P opens searchable command list |
| E8.4.2 | As a user, I can execute any action from palette | All menu items and actions searchable |
| E8.4.3 | As a user, I see keyboard shortcuts in palette | Each command shows its shortcut |

---

## Epic 9: Linking & Discovery

### 9.1 Internal Links

**Priority**: P0 | **Status**: 🟢 Done

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E9.1.1 | As a user, I can create links with `[[filename]]` | Wiki-style link syntax, autocomplete as I type |
| E9.1.2 | As a user, links are pure markdown in source | `[[note]]` stored as `[note](note.md)` in raw markdown |
| E9.1.3 | As a user, clicking a link opens that document | Cmd/Ctrl+click or single click opens linked file |
| E9.1.4 | As a user, I can create links to non-existent files | Link shown differently, clicking creates the file |
| E9.1.5 | As a user, I can see backlinks to current document | Panel showing all documents linking to this one |

### 9.2 Document Discovery

**Priority**: P1 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E9.2.1 | As a user, I can see related documents | Based on semantic similarity (vector search) |
| E9.2.2 | As a user, I can discover unlinked mentions | Text matching file names that aren’t links yet |
| E9.2.3 | As a user, I can convert mentions to links | Click to convert text to internal link |

---

## Epic 10: Mobile App

### 10.1 iOS App

**Priority**: P0 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E10.1.1 | As a user, I can download Jot from iOS App Store | App listed, free download |
| E10.1.2 | As a user, I can open folders from Files app | Document picker integration |
| E10.1.3 | As a user, I have same editing experience as desktop | TipTap editor works on iOS, WYSIWYG functions |
| E10.1.4 | As a user, I can use keyboard shortcuts with external keyboard | iPad with keyboard support |
| E10.1.5 | As a user, mobile app respects system dark mode | Theme follows iOS settings |

### 10.2 Android App

**Priority**: P1 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E10.2.1 | As a user, I can download Jot from Play Store | App listed, free download |
| E10.2.2 | As a user, I can open folders from device storage | SAF (Storage Access Framework) integration |
| E10.2.3 | As a user, I have same editing experience as desktop | TipTap editor works on Android |

### 10.3 Sync Strategy

**Priority**: P1 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E10.3.1 | As a user, I can sync via iCloud Drive | iOS/macOS sync through iCloud |
| E10.3.2 | As a user, I can sync via any cloud provider | Works with Dropbox, Google Drive, OneDrive folders |
| E10.3.3 | As a user, conflicts are handled gracefully | Conflict detection with resolution UI |

---

## Epic 11: Performance & Polish

### 11.1 Startup Performance

**Priority**: P0 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E11.1.1 | As a user, app starts in under 1 second | Cold start < 1s on modern hardware |
| E11.1.2 | As a user, recent file loads instantly | Last open file ready immediately |
| E11.1.3 | As a user, app is lightweight | macOS/Windows bundle < 50MB |

### 11.2 Editor Performance

**Priority**: P0 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E11.2.1 | As a user, typing is instant with no lag | No perceptible delay when typing |
| E11.2.2 | As a user, large files (10k+ words) work smoothly | Documents up to 100k words perform well |
| E11.2.3 | As a user, search results appear instantly | Search as you type with no delay |

### 11.3 Accessibility

**Priority**: P1 | **Status**: 🔴 Backlog

| ID | User Story | Acceptance Criteria |
| --- | --- | --- |
| E11.3.1 | As a user, I can navigate with keyboard only | All features accessible without mouse |
| E11.3.2 | As a user, screen reader works with editor | VoiceOver/NVDA compatibility |
| E11.3.3 | As a user, I can increase contrast | High contrast theme available |

---

## Release Plan

### v1.0 - MVP Release

**All P0 items completed**

-   Core WYSIWYG editing with TipTap
    
-   File tree and document outline navigation
    
-   Autosave and version history
    
-   Keyword search (local and global)
    
-   Semantic search (opt-in)
    
-   Spell check and grammar (LanguageTool)
    
-   PDF and Word export
    
-   Light/dark themes and typography customization
    
-   Internal linking with backlinks
    
-   iOS app in App Store
    
-   Desktop apps for macOS, Windows, Linux
    

### v1.1 - Enhancement Release

**P1 items**

-   External change detection
    
-   HTML export
    
-   Math/LaTeX support
    
-   Command palette
    
-   Customizable keyboard shortcuts
    
-   Android app
    
-   Sync conflict resolution
    
-   Accessibility improvements
    

### v1.2+ - Future

**P2 items and community requests**

-   Graph view visualization
    
-   Canvas/whiteboard feature
    
-   Plugin system
    
-   Additional export formats
    
-   Community themes
    

---

## Technical Notes

### Rust Crates to Evaluate

-   `hnsw` or custom implementation for vector index
    
-   `rusqlite` for SQLite
    
-   `fastembed-rs` or ONNX runtime for embeddings
    
-   `tauri` 2.0 for desktop app
    

### React/TypeScript Libraries

-   `@tiptap/react` for editor
    
-   `@tiptap/extension-*` for markdown extensions
    
-   `mermaid` for diagram rendering
    
-   `katex` for math rendering
    
-   `docx` for Word export
    
-   `pdf-lib` for PDF generation
    

### Mobile Considerations

-   React Native with `react-native-webview` for TipTap
    
-   Rust core via `uniffi` for mobile bindings
    
-   File system access via platform-specific APIs
    

---

## Open Questions

1.  **Model hosting**: Where to host embedding model for download? GitHub releases? CDN?
    
2.  **Update mechanism**: How to handle app updates? Auto-update or manual?
    
3.  **Telemetry**: Any anonymous usage analytics? (User opt-in only)
    
4.  **Licensing**: MIT? GPL? Apache 2.0?
    
5.  **Branding**: Final logo and visual identity
    

---

*Document last updated: 2026-01-29Version: 1.0-draft*

---

## Implementation Progress

### Completed User Stories

-   E1.1.1: TipTap editor renders markdown as user types ✅
    
-   E1.1.3: Keyboard shortcuts for formatting (Cmd+B, Cmd+I, etc.) ✅
    
-   E1.1.4: Formatting toolbar with headings, bold, italic, lists, etc. ✅
    
-   E1.1.5: Tables with visual editing ✅
    
-   E1.1.6: Image insertion and preview ✅
    
-   E1.3.1: Fenced code blocks with language selector ✅
    
-   E1.3.2: Syntax highlighting for 100+ languages ✅
    
-   E1.3.3: Copy code button on hover ✅
    
-   E1.3.4: Line numbers toggle ✅
    
-   E2.1.1: File tree showing markdown files and folders ✅
    
-   E2.1.2: Expand/collapse folders ✅
    
-   E2.1.3: Create new files/folders via context menu ✅
    
-   E2.1.6: Delete files with confirmation dialog ✅
    
-   E2.2.1: Document outline showing H1-H6 hierarchy ✅
    
-   E2.2.2: Click outline item to navigate to heading ✅
    
-   E2.2.3: Current section highlighted as user scrolls ✅
    
-   E2.2.4: Filter outline by search ✅
    
-   E3.1.1: Auto-save after 1 second of inactivity ✅
    
-   E3.1.2: Save status indicator (“Saving…”, “Saved”) ✅
    
-   E3.1.3: Cmd/Ctrl+S triggers immediate save ✅
    
-   E3.1.4: Crash recovery via localStorage ✅
    
-   E8.1.1: Three-panel layout (sidebar, editor) ✅
    
-   E8.1.2: Collapse/expand sidebar with Cmd+B ✅
    
-   E8.3.1: Clean toolbar at top of document ✅
    
-   E8.3.2: Toolbar includes all formatting options ✅
    
-   E1.1.2: Source/WYSIWYG view toggle ✅
    
-   E1.1.7: Internal links with `[[filename]]` syntax and autocomplete ✅
    
-   E9.1.1: Wiki-style links with autocomplete as you type ✅
    
-   E9.1.2: Links stored as standard markdown `[text](file.md)` ✅
    
-   E9.1.3: Click internal link to navigate to document ✅

-   E1.1.8: Internal links to specific headings (`[[filename#heading]]`) ✅

-   E9.1.4: Non-existent file links styled differently, create on click ✅

-   E9.1.5: Backlinks panel showing documents linking to current ✅

-   E8.3.3: Toolbar shows active formatting state ✅

-   E1.2.1: Mermaid code blocks recognized and rendered ✅

-   E1.2.2: Diagrams render inline (flowcharts, sequence, Gantt, pie, class) ✅

-   E1.2.3: Click-to-edit diagram source with edit/preview toggle ✅

-   E1.2.4: Export diagrams as PNG/SVG via dropdown menu ✅

-   E1.2.5: Diagrams sync with light/dark theme ✅

-   E2.1.4: Auto-link update on rename ✅

-   E2.1.5: Drag-drop file move with auto-link update ✅

-   E2.1.7: Sort files by name/date with dropdown ✅

-   E3.2.1: View version history via title bar button ✅

-   E3.2.2: Timestamped snapshots with date grouping and preview ✅

-   E3.2.3: Restore any previous version with confirmation ✅

-   E3.2.4: Compare versions with split/unified diff view ✅

-   E3.2.5: SQLite storage with 30-day configurable retention ✅

-   E4.1.1: In-document search with Cmd+F, highlights matches ✅

-   E4.1.2: Find and replace with Replace/Replace All buttons ✅

-   E4.1.3: Global workspace search with Cmd+Shift+F ✅

-   E4.1.4: Search results with file name, line number, context ✅

-   E4.1.5: Path filter support (glob patterns like `docs/*.md`) ✅

-   E4.1.6: Regex mode toggle in both local and global search ✅

-   E2.3.1: Open folder as workspace via Cmd+O ✅

-   E2.3.2: Default workspace auto-opens on startup ✅

-   E2.3.3: Recent workspaces menu with Cmd+Shift+O hint ✅

-   E2.3.4: Switch workspaces without restart (with unsaved prompt) ✅

-   E2.3.5: Workspace settings stored in `.jot/config.json` ✅

-   E8.1.1: Three-panel layout (sidebar, editor, right panels) ✅

-   E8.1.2: Collapse/expand sidebar with Cmd+B ✅

-   E8.1.3: Resizable sidebar via drag handle ✅

-   E8.1.4: Zen mode (distraction-free) with Escape to exit ✅

-   E8.1.5: Layout state (width, visibility) persists across sessions ✅

-   E8.2.1: Open multiple files in tabs (click file opens in tab) ✅

-   E8.2.2: Reorder tabs by drag-and-drop ✅

-   E8.2.3: Close tabs with middle-click or X button ✅

-   E8.2.4: Unsaved indicator (dot) on dirty tabs ✅

-   E8.2.5: Pin tabs via right-click context menu (pinned stay left) ✅

-   E8.3.4: Theme/style access in toolbar (light/dark/system theme, font family) ✅

-   E7.2.1: Font family selector (serif/sans/mono) ✅

-   E7.2.2: Font size slider with Cmd+/-/0 shortcuts ✅

-   E7.2.3: Line height adjustment slider ✅

-   E7.2.4: Maximum line width control ✅

-   E7.2.5: Bundled fonts (Crimson Pro, Inter, JetBrains Mono) ✅

-   E7.3.1: Focus mode toggle (dims non-active paragraphs) ✅

-   E7.3.2: Typewriter mode toggle (centers current line) ✅

-   E7.3.3: Line numbers toggle (in toolbar) ✅

-   E7.3.4: Settings panel with organized sections ✅

-   E7.1.1: Light/dark mode toggle with system preference ✅

-   E7.1.2: 5 built-in themes (Paper, Midnight, Sepia, High Contrast, Olive) ✅

-   E7.1.3: Curated accent colors per theme (5 options each) ✅

-   E7.1.4: Theme applies consistently to editor and UI ✅


### Remaining P0 Work

-   Epic 4.2: Semantic search (vector)

-   Epic 5.1-5.2: Spell/grammar check

-   Epic 6.1-6.2, 6.4: Export (PDF, Word, Copy Formatted)

-   Epic 10.1: iOS app

-   Epic 11.1-11.2: Performance

### Completed P0 Epics

-   ~~Epic 1.1: WYSIWYG Markdown Editing~~ ✅
-   ~~Epic 1.2: Mermaid Diagram Support~~ ✅
-   ~~Epic 1.3: Code Blocks~~ ✅
-   ~~Epic 2.1: File Tree Navigation~~ ✅
-   ~~Epic 2.2: Document Outline~~ ✅
-   ~~Epic 2.3: Workspace Management~~ ✅
-   ~~Epic 3.1: Automatic Saving~~ ✅
-   ~~Epic 3.2: Version History~~ ✅
-   ~~Epic 4.1: Keyword Search~~ ✅
-   ~~Epic 7.1: Themes & Appearance~~ ✅
-   ~~Epic 7.2: Typography~~ ✅
-   ~~Epic 7.3: Editor Preferences~~ ✅
-   ~~Epic 8.1: Layout & Panels~~ ✅
-   ~~Epic 8.2: Tabs & Multi-file~~ ✅
-   ~~Epic 8.3: Formatting Toolbar~~ ✅
-   ~~Epic 9.1: Internal Links~~ ✅
    

### Known Bugs

#### 🟢 RESOLVED: File Corruption on Save (HTML Encoding)

**Priority**: P0 | **Status**: 🟢 Done

**Symptom**: Markdown files saved with HTML-encoded content like `&lt;p&gt;# Title&amp;gt;` instead of clean markdown.

**Resolution**: Replaced custom markdown converters with battle-tested libraries:

-   **markdown-it** for Markdown → HTML (CommonMark compliant, Shiki-compatible)
-   **turndown** for HTML → Markdown (robust conversion with custom rules)

**Commits**:
-   `98fb644` - feat(markdown): replace custom converters with markdown-it + turndown
-   `4dcf2a6` - fix(lib): remove reading-time package (not browser-compatible)

**Tests Added**:
-   `src/lib/markdown/fileConversion.test.ts` - 30 comprehensive round-trip tests
-   Tests cover: JSX, SQL, YAML, TypeScript generics, unicode, nested structures, task lists, tables, and more

**Future Enhancement**: Add `tiptap-extension-code-block-shiki` for VS Code-quality syntax highlighting.

---

### Infrastructure Improvements

#### Utility Package Replacements (2026-01-29)

Replaced custom utility implementations with battle-tested packages:

| Package | Purpose | Replaces |
|---------|---------|----------|
| `github-slugger` | Heading ID generation | Custom slug function |
| `normalize-path` | Cross-platform paths | Manual path handling |
| `is-path-inside` | Path security checks | String prefix check |
| `he` | HTML entity decoding | N/A (new capability) |

**Commit**: `2bbcb0c` - refactor(lib): replace custom utilities with battle-tested packages

**Note**: `reading-time` was initially added but removed - it uses Node.js streams incompatible with browser environments.