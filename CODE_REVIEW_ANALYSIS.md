# Jot File Editing Subsystem — Code Review Analysis

> Comprehensive review of the 5 core file editing subsystems, conducted 2026-02-06.
> Organized into implementation phases by priority and dependency.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Phase 1: Critical Data Safety](#phase-1-critical-data-safety)
- [Phase 2: Concurrency & Race Conditions](#phase-2-concurrency--race-conditions)
- [Phase 3: Security & Cross-Platform](#phase-3-security--cross-platform)
- [Phase 4: Performance Optimization](#phase-4-performance-optimization)
- [Phase 5: Architecture Cleanup](#phase-5-architecture-cleanup)
- [Phase 6: Test Coverage Gaps](#phase-6-test-coverage-gaps)
- [Appendix: What's Working Well](#appendix-whats-working-well)

---

## Architecture Overview

The file editing pipeline flows:

```
Open file (Tauri/Rust) → Load into CodeMirror → Edit with WYSIWYG
  → Autosave (debounced 1s) → Atomic write to disk → Version history (SQLite)
  → Update indexes (backlinks, semantic)
```

### Subsystems Reviewed

| Subsystem | Key Files | Tests |
|-----------|-----------|-------|
| Rust File I/O | `src-tauri/src/lib.rs`, `src/lib/tauri/files.ts` | 6 Rust tests |
| Save Pipeline | `src/services/saveService.ts` | 20+ tests |
| Autosave & Crash Recovery | `src/hooks/useAutosave.ts` | 13 tests |
| Zustand Stores | `editorStore.ts`, `tabsStore.ts`, `workspaceStore.ts` | Good per-store coverage |
| CodeMirror Integration | `CodeMirrorEditor.tsx`, `extensions/index.ts` | Handler tests only, 0 component tests |

### Issue Summary

| Severity | Count |
|----------|-------|
| Critical | 4 |
| High | 7 |
| Medium | 15 |
| Low | ~10 |

---

## Phase 1: Critical Data Safety

> Prevent data loss. These are the highest-impact issues with the simplest fixes.
> Estimated scope: 3 focused changes, minimal risk.

### 1.1 Add `fsync` Before Persist (Rust)

- **Severity**: Critical
- **Category**: Data Integrity
- **Location**: `src-tauri/src/lib.rs:76-81`
- **Impact**: One-line fix for true crash safety

**Problem**: `flush()` only pushes data from userspace to the OS kernel buffer — it does NOT guarantee data reaches the physical disk. A power loss after `flush()` but before the kernel writes to disk can produce zero-length or partial files, despite the "atomic write" pattern.

**Fix**: Add `temp.as_file().sync_data()` after `flush()` and before `persist()`. Adds ~1-5ms per save on SSD, acceptable for a 1-second autosave interval.

```rust
temp.write_all(content.as_bytes())
    .map_err(|e| format!("Failed to write content: {}", e))?;
temp.flush()
    .map_err(|e| format!("Failed to flush content: {}", e))?;
// Ensure data reaches disk before rename
temp.as_file().sync_data()
    .map_err(|e| format!("Failed to sync to disk: {}", e))?;
```

---

### 1.2 Fix Backup File Name Collision (Rust)

- **Severity**: Critical
- **Category**: Bug
- **Location**: `src-tauri/src/lib.rs:88`
- **Impact**: Prevents silent data destruction between files

**Problem**: `Path::with_extension("jot-bak")` *replaces* the extension rather than appending. Two files differing only by extension (e.g., `notes.md` and `notes.txt`) produce the **same** backup name (`notes.jot-bak`), silently overwriting each other's backups.

**Fix**: Append `.jot-bak` to the full filename instead of replacing the extension:

```rust
// Before (broken):
let backup = target.with_extension("jot-bak");

// After (correct):
let backup = PathBuf::from(format!("{}.jot-bak", target.display()));
```

---

### 1.3 Add Save-on-Close Handler

- **Severity**: Critical
- **Category**: Data Loss Prevention
- **Location**: `src/hooks/useAutosave.ts` (missing feature)
- **Impact**: Prevents the most common real-world data loss scenario

**Problem**: No `beforeunload` or Tauri `onCloseRequested` handler exists anywhere in the codebase. If the user closes the app with a pending debounce (up to 1000ms of unsaved content), the save is canceled and content is lost. Crash recovery in localStorage partially mitigates this but requires manual acceptance on next launch.

**Fix**: Add a Tauri `onCloseRequested` handler in `App.tsx` that flushes all pending saves before allowing the window to close:

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

useEffect(() => {
  const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
    const dirtyTabs = useTabsStore.getState().tabs.filter(t => t.isDirty);
    if (dirtyTabs.length > 0) {
      event.preventDefault();
      await saveAllDirtyTabs();
      getCurrentWindow().close();
    }
  });
  return () => { unlisten.then(fn => fn()); };
}, []);
```

---

### 1.4 Fix Backup Restore Error Reporting (Rust)

- **Severity**: High
- **Category**: Error Handling
- **Location**: `src-tauri/src/lib.rs:106-108`
- **Impact**: Prevents unrecoverable silent data loss

**Problem**: If `temp.persist(target)` fails AND the backup restore (`fs::rename(&backup, target)`) also fails, the user has lost their file. The only error returned is from the persist step — no mention of the backup file's location.

**Fix**: Include the backup path in the error message:

```rust
if result.is_err() && had_backup {
    if let Err(restore_err) = fs::rename(&backup, target) {
        return Err(format!(
            "Failed to save file AND restore backup. Your data is at: {}. Error: {}",
            backup.display(), restore_err
        ));
    }
}
```

---

## Phase 2: Concurrency & Race Conditions

> Fix save interleaving and data races. These require more careful changes.
> Estimated scope: 4-5 changes across save pipeline and autosave.

### 2.1 Add Save Mutex to `saveDocumentPipeline`

- **Severity**: High
- **Category**: Race Condition
- **Location**: `src/services/saveService.ts:61`
- **Impact**: Prevents concurrent save corruption

**Problem**: `saveDocumentPipeline` is a plain async function with no locking. Multiple code paths can call it simultaneously:
- `App.tsx:594` — workspace switch
- `App.tsx:637` — Cmd+S via `saveNow()`
- `App.tsx:660` — tab switch
- `App.tsx:706` — tab close
- `App.tsx:790` — close-all loop

The `isSavingRef` guard in `useAutosave` only protects the hook's own calls. Direct calls from `App.tsx` bypass it entirely.

**Fix**: Add a per-file save queue inside `saveDocumentPipeline`:

```typescript
const inFlightSaves = new Map<string, Promise<SaveResult>>();

export async function saveDocumentPipeline(
  tabId: string, isActiveDoc: boolean
): Promise<SaveResult> {
  const tab = useTabsStore.getState().tabs.find(t => t.id === tabId);
  if (!tab) return { saved: false, isClean: false };

  const existing = inFlightSaves.get(tab.filePath);
  if (existing) {
    // Wait for current save, then check if still dirty
    await existing;
    return { saved: false, isClean: false };
  }

  const savePromise = doSave(tabId, isActiveDoc);
  inFlightSaves.set(tab.filePath, savePromise);
  try {
    return await savePromise;
  } finally {
    inFlightSaves.delete(tab.filePath);
  }
}
```

---

### 2.2 Queue Dropped Saves Instead of Silently Discarding

- **Severity**: High
- **Category**: Data Loss Risk
- **Location**: `src/hooks/useAutosave.ts:80`
- **Impact**: Makes Cmd+S reliable during autosave

**Problem**: If `performSave` is called while `isSavingRef.current` is true, the save is silently dropped. User presses Cmd+S during autosave — nothing happens, no feedback.

**Fix**: Set a `pendingSave` flag when a save is dropped, and check it in the `finally` block:

```typescript
const pendingSaveRef = useRef(false);

const performSave = useCallback(async (tabId: string) => {
  if (isSavingRef.current) {
    pendingSaveRef.current = true; // Queue instead of drop
    return;
  }
  isSavingRef.current = true;
  try {
    // ... existing save logic ...
  } finally {
    isSavingRef.current = false;
    if (pendingSaveRef.current) {
      pendingSaveRef.current = false;
      performSave(useTabsStore.getState().activeTabId ?? tabId);
    }
  }
}, [/* deps */]);
```

---

### 2.3 Make Crash Recovery Per-Tab

- **Severity**: High
- **Category**: Data Loss Risk
- **Location**: `src/hooks/useAutosave.ts:9`
- **Impact**: Prevents multi-tab data loss on crash

**Problem**: Crash recovery uses a single `jot_crash_recovery` localStorage key. Switching tabs overwrites the previous tab's recovery data. On crash, only the last-active tab's content survives.

**Fix**: Store a map of all dirty tabs:

```typescript
const CRASH_RECOVERY_KEY = "jot_crash_recovery_v2";

function storeCrashRecovery(tabId: string, filePath: string, content: string) {
  try {
    const existing = JSON.parse(localStorage.getItem(CRASH_RECOVERY_KEY) || "{}");
    existing[tabId] = { filePath, content, timestamp: Date.now() };
    localStorage.setItem(CRASH_RECOVERY_KEY, JSON.stringify(existing));
  } catch { /* quota exceeded — log warning */ }
}

function clearCrashRecovery(tabId: string) {
  try {
    const existing = JSON.parse(localStorage.getItem(CRASH_RECOVERY_KEY) || "{}");
    delete existing[tabId];
    localStorage.setItem(CRASH_RECOVERY_KEY, JSON.stringify(existing));
  } catch { /* ignore */ }
}
```

---

### 2.4 Fix `useEditorStore()` Without Selector in `useAutosave`

- **Severity**: Critical (React 19 infinite loop risk)
- **Category**: React Compatibility
- **Location**: `src/hooks/useAutosave.ts:44`
- **Impact**: Prevents React 19 infinite loop and unnecessary re-renders

**Problem**: `const { filePath, isDirty, setSaveStatus, setContent } = useEditorStore();` subscribes to the **entire store**. Every sidebar toggle, font change, or theme switch triggers re-render + effect re-execution. React 19's `useSyncExternalStore` could enter an infinite loop.

**Fix**: Replace with individual selectors:

```typescript
const filePath = useEditorStore((s) => s.filePath);
const isDirty = useEditorStore((s) => s.isDirty);
const setSaveStatus = useEditorStore((s) => s.setSaveStatus);
const setContent = useEditorStore((s) => s.setContent);
```

---

### 2.5 Fix File Switch Content Sync Race Condition

- **Severity**: High
- **Category**: Bug
- **Location**: `CodeMirrorEditor.tsx:264-280`
- **Impact**: Prevents stale content display and spurious autosaves on file switch

**Problem**: The file-switch effect reads `useEditorStore.getState().content` which depends on the store having already been updated. The update listener also fires for the synthetic content replacement, which could re-trigger autosave with the new file's content before it's fully loaded.

**Fix**: Add a transaction annotation to mark file-switch dispatches, and skip `onUpdate` for those:

```typescript
import { Annotation } from "@codemirror/state";
const fileSwitchAnnotation = Annotation.define<boolean>();

// In file-switch effect:
viewRef.current.dispatch({
  changes: { from: 0, to: view.state.doc.length, insert: markdown },
  annotations: fileSwitchAnnotation.of(true),
});

// In update listener:
EditorView.updateListener.of((update) => {
  if (update.docChanged && !update.transactions.some(
    tr => tr.annotation(fileSwitchAnnotation)
  )) {
    // ... normal update handling ...
  }
});
```

---

## Phase 3: Security & Cross-Platform

> Close security gaps and fix cross-platform issues.
> Estimated scope: 4-5 changes, mostly in Rust.

### 3.1 Add Workspace Validation to Directory Read Commands

- **Severity**: High
- **Category**: Security
- **Location**: `src-tauri/src/lib.rs:161, 243`
- **Impact**: Closes the most significant sandbox escape

**Problem**: `jot_read_directory` and `jot_read_folder_children` accept arbitrary paths with no workspace validation. A compromised frontend could enumerate any directory on the system. All other file commands correctly call `validate_in_workspace`.

**Fix**: Add `workspace_path` parameter and validation:

```rust
#[tauri::command]
fn jot_read_directory(path: &str, workspace_path: &str) -> Result<Vec<FileEntry>, String> {
    validate_in_workspace(path, workspace_path, true)?;
    read_dir_recursive(path, 0)
}
```

Update TypeScript wrapper to pass `workspacePath`.

---

### 3.2 Add Workspace Validation to `jot_get_file_info` and `jot_path_exists`

- **Severity**: Medium
- **Category**: Security
- **Location**: `src-tauri/src/lib.rs:408, 438`

**Problem**: These commands can probe any path on the system without workspace validation.

**Fix**: Same pattern as 3.1 — add `workspace_path` parameter and validate.

---

### 3.3 Add Symlink Cycle Protection to `read_dir_recursive`

- **Severity**: High
- **Category**: Security
- **Location**: `src-tauri/src/lib.rs:179-237`

**Problem**: `collect_markdown_files` (search) has proper symlink cycle detection via a visited set, but `read_dir_recursive` (file tree) has none. Inconsistent security posture.

**Fix**: Add a `visited: &mut HashSet<PathBuf>` parameter and check canonicalized paths against it, matching the pattern in `collect_markdown_files`.

---

### 3.4 Use Tauri `open()` API for External Links

- **Severity**: Medium
- **Category**: Cross-Platform
- **Location**: `src/components/editor/codemirror/handlers/linkHandlers.ts:295, 409`

**Problem**: `window.open(url, "_blank")` may not open the system browser in Tauri's webview on Linux.

**Fix**: Use `@tauri-apps/plugin-opener`:

```typescript
import { open } from '@tauri-apps/plugin-opener';
// Replace: window.open(url, "_blank", "noopener,noreferrer");
// With:
open(url);
```

---

### 3.5 Fix Case-Insensitive Path Matching in `tabsStore`

- **Severity**: Medium
- **Category**: Cross-Platform Bug
- **Location**: `src/stores/tabsStore.ts:109, 266-268`

**Problem**: `findTabByPath` and `openTab` use strict string equality (`===`) for path comparison. On case-insensitive filesystems (macOS, Windows), `/Users/foo/Notes.md` and `/Users/foo/notes.md` are the same file but would create separate tabs.

**Fix**: Use the existing `isCaseSensitiveFs` flag from `editorStore` for path comparison:

```typescript
const pathsEqual = (a: string, b: string, caseSensitive: boolean) =>
  caseSensitive ? a === b : a.toLowerCase() === b.toLowerCase();
```

---

## Phase 4: Performance Optimization

> Improve performance for large documents. Profile before implementing.
> Estimated scope: 3-4 targeted optimizations.

### 4.1 Scope Regex Fallback to Changed Region in `getHiddenRanges()`

- **Severity**: High
- **Category**: Performance
- **Location**: `src/components/editor/codemirror/extensions/hiddenRanges.ts:278`

**Problem**: `doc.toString()` allocates a full document string on every keystroke for the regex fallback. For 10K+ line documents, this is multi-MB per keystroke. Five regex patterns run on the full text.

**Fix options**:
1. Use `tr.changes` to determine affected line ranges and only regex-check those lines
2. Replace `isAlreadyCollected` O(n) scan with a `Set<string>` of `${from}-${to}` keys
3. Profile to determine if the regex fallback can be eliminated entirely (Lezer AST may cover all cases)

---

### 4.2 Share `collectCodeBlockExtents()` Between Extensions

- **Severity**: Medium
- **Category**: Performance (Redundant Work)
- **Location**: `hiddenRanges.ts`, `styleDecorations.ts`

**Problem**: Both `getHiddenRanges()` and `buildStyleDecorations()` independently call `collectCodeBlockExtents(state)` and `doc.toString()`, doubling the AST walk and string allocation.

**Fix**: Extract code block extents into a shared `StateField`:

```typescript
export const codeBlockExtentsField = StateField.define<Array<{from: number, to: number}>>({
  create: (state) => collectCodeBlockExtents(state),
  update: (extents, tr) => tr.docChanged ? collectCodeBlockExtents(tr.state) : extents,
});
```

---

### 4.3 Guard `pendingFormattingField` Against Unnecessary Rebuilds

- **Severity**: Medium
- **Category**: Performance
- **Location**: `src/components/editor/codemirror/extensions/pendingFormat.ts:86-90`

**Problem**: `buildPendingFormattingDecorations()` runs unconditionally on every transaction, including focus changes and scroll events.

**Fix**: Add a guard:

```typescript
update(decorations, tr) {
  if (!tr.docChanged && !tr.selection) return decorations;
  return buildPendingFormattingDecorations(tr.state);
}
```

---

### 4.4 Optimize Version History Preview Query

- **Severity**: Medium
- **Category**: Performance
- **Location**: `src-tauri/src/version_history.rs:194-214`

**Problem**: `get_versions` fetches the full `content` column from SQLite for every version just to compute a 100-character preview. For files with many versions and large content, this transfers megabytes of data that is immediately discarded.

**Fix**: Use SQL `SUBSTR`:

```sql
SELECT id, file_path, SUBSTR(content, 1, 120), created_at, byte_size, word_count
FROM versions WHERE file_path = ?1 ORDER BY created_at DESC LIMIT ?2
```

Or store the preview as a separate column at write time.

---

## Phase 5: Architecture Cleanup

> Larger structural improvements. These reduce the surface area for future bugs.
> Estimated scope: Significant refactoring — plan carefully.

### 5.1 Eliminate Dual Source of Truth (editorStore + tabsStore)

- **Severity**: Critical (Architecture)
- **Category**: Architecture
- **Location**: `src/stores/editorStore.ts`, `src/stores/tabsStore.ts`, `App.tsx` (~12 sync points)

**Problem**: Both stores independently track `content`, `isDirty`, `filePath`, and `saveStatus`. Manual synchronization occurs across 12+ locations in `App.tsx`. The save pipeline reads dirty state from `tabsStore` but writes save status to `editorStore`. Every new feature touching document state must update both stores correctly.

**Recommendation**: Eliminate `content`, `isDirty`, `filePath`, `saveStatus`, and `saveError` from `editorStore`. Make `tabsStore` the single source of truth for document state. `editorStore` should only contain UI preferences (theme, font, sidebar, etc.). Derive "active document" state from `tabsStore` via selectors.

This is a large refactor. Approach:
1. Add `saveStatus` and `saveError` to the Tab type in `tabsStore`
2. Create derived selectors: `selectActiveContent`, `selectActiveFilePath`, `selectActiveIsDirty`
3. Update all consumers to use tabsStore selectors
4. Remove document state from editorStore
5. Delete the 12+ manual sync points in App.tsx

---

### 5.2 Remove Dangerous Exported Selectors

- **Severity**: High
- **Category**: React 19 Compatibility
- **Location**: `editorStore.ts:210-238`, `workspaceStore.ts:282-339`

**Problem**: `selectDocument`, `selectUIState`, `selectLayoutState`, `selectAllFilePaths`, and `selectAllFilesForSuggestion` all return new objects/arrays on every call. If passed directly to Zustand hooks, they cause React 19 infinite loops. They are exported but unused — traps for future developers.

**Fix**: Delete these selectors or add `@deprecated` warnings with explanation:

```typescript
/**
 * @deprecated Do NOT pass to useEditorStore() — creates new object on every call.
 * Use individual primitive selectors instead. See CLAUDE.md "React 19 + Zustand".
 */
```

---

### 5.3 Extract Rust `lib.rs` Into Modules

- **Severity**: Low
- **Category**: Architecture / Maintainability
- **Location**: `src-tauri/src/lib.rs` (1589 lines)

**Problem**: `lib.rs` contains file I/O, search, version history wrappers, settings, personal dictionary, and grammar rules. It's overdue for module extraction.

**Recommendation**: Extract into:
- `mod fs_utils;` — `atomic_write`, `validate_in_workspace`, `is_hidden_file`, `is_markdown_file`
- `mod search;` — `search_file`, `search_workspace_sync`, `collect_markdown_files`
- `mod settings;` — settings management
- `mod dictionary;` — personal dictionary
- `mod grammar_rules;` — grammar rules

---

### 5.4 Clean Up Module-Level State in CodeMirror Handlers

- **Severity**: High
- **Category**: Memory/State Leak
- **Location**: `linkHandlers.ts:56-61`, `inputHandler.ts:35`, `spellcheck.ts:323`

**Problem**: `linkEditorState`, `linkContextMenuState`, and `pendingEscape` are module-level mutable variables that hold EditorView references. They leak across file switches and are never cleaned up.

**Fix**: Add cleanup calls in `CodeMirrorEditor.tsx` cleanup and file-switch effects:

```typescript
// In cleanup (line 256-260):
return () => {
  closeLinkEditor();
  closeLinkContextMenu();
  clearPendingEscape();
  view.destroy();
  viewRef.current = null;
};

// In file-switch effect (line 264-280):
clearPendingEscape();
```

---

### 5.5 Clear Undo History on File Switch

- **Severity**: Medium
- **Category**: State Leak
- **Location**: `CodeMirrorEditor.tsx:264-280`

**Problem**: When switching files, the editor dispatches a full content replacement which adds to the existing undo history. Users can Cmd+Z back into content from a completely different file.

**Fix**: Create a fresh EditorState on file switch instead of dispatching a content change, or clear history explicitly.

---

## Phase 6: Test Coverage Gaps

> Missing tests organized by subsystem. Prioritize Phase 6A first.

### Phase 6A: Critical Missing Tests

| Test | Location | Why It Matters |
|------|----------|----------------|
| `CodeMirrorEditor.test.tsx` — component lifecycle | `components/editor/codemirror/` | Zero React component tests for mount/unmount, file switching, mode switching, store sync |
| File switching behavior | `components/editor/codemirror/` | Content sync, history isolation, spurious onUpdate during switch |
| Source mode round-trip | `components/editor/codemirror/` | WYSIWYG -> Source -> WYSIWYG without data loss |
| Concurrent `saveDocumentPipeline` calls | `services/` | The primary race condition risk |
| Cmd+S while autosave is in-flight | `hooks/` | Silent save drop is user-facing |
| Debounce timing verification | `hooks/` | Core autosave mechanism has zero test coverage |
| Cross-store synchronization | `stores/` | editorStore + tabsStore invariants |
| `selectionSnapper.test.ts` | `extensions/` | Referenced in MEMORY.md but doesn't exist in repo |

### Phase 6B: Rust Backend Missing Tests

| Test | Why It Matters |
|------|----------------|
| `validate_in_workspace` with path traversal (`../../../etc/passwd`) | Most common attack vector |
| `validate_in_workspace` with `must_exist=false` | Different code path, untested |
| `atomic_write` failure recovery (backup restore path) | Error recovery path never exercised |
| `atomic_write` with Unicode content (emoji, CJK) | UTF-8 round-trip for a text editor |
| `is_hidden_file` unit test | Zero tests for hidden file detection |
| `is_markdown_file` case sensitivity (`.MD`, `.mD`) | Claimed but untested |
| `read_dir_recursive` with nested structure | Recursive traversal untested |
| `byte_offset_to_utf16_offset` with multi-byte chars | Emoji/surrogate pair logic untested |

### Phase 6C: Store & Service Missing Tests

| Test | Why It Matters |
|------|----------------|
| `updateTabContent` for non-existent tab | Silent no-op, should be verified |
| `renameTab` when target path already open | Could create duplicate tabs |
| `removeEntry` state cleanup (`selectedPath`, `expandedPaths`) | Stale state after deletion |
| Rapid sequential `openTab` for same file | TOCTOU race in duplicate check |
| `saveAllDirtyTabs` partial failure state | Verify saved tabs are marked clean |
| `workspacePath` null/undefined in save pipeline | Error propagation untested |
| Tab deleted during in-flight save | Guard check returns undefined |

### Phase 6D: Lower Priority Missing Tests

| Test | Why It Matters |
|------|----------------|
| `pendingFormat` field detection logic | Zero tests for empty marker detection |
| Spellcheck CodeMirror extension | Debounced checking, excluded positions |
| Extension bundle smoke test | Verify `createWysiwygExtensions()` creates valid state |
| `collect_markdown_files` depth limiting | MAX_DEPTH=20 behavior |
| Version history timestamp collision retry | Retry logic exists but untested |
| Large document (10MB+) save behavior | localStorage quota, save performance |

---

## Appendix: What's Working Well

These aspects of the codebase are solid and should be preserved:

- **Unified save pipeline** — Single `saveDocumentPipeline` for all save paths prevents inconsistent behavior
- **Content-changed-during-save guard** — Captures content snapshot at save start, compares after async write to detect concurrent edits
- **Tab ID captured at debounce schedule time** — Prevents the tab-switch race condition in autosave
- **Atomic write with backup pattern** — Crash-safe file writes (minus fsync, addressed in Phase 1)
- **Version history deduplication** — `is_content_changed` prevents duplicate version saves
- **React 19 awareness in consuming code** — Individual primitive selectors used consistently across 60+ sites in `App.tsx` and components
- **Clean CodeMirror extension architecture** — Well-separated modules with correct dependency ordering (`hiddenRangesField` before `hiddenSyntaxField` before `selectionSnapper`)
- **`onUpdateRef` pattern** — Ref for the `onUpdate` callback avoids stale closures in the mount-only effect
- **Comprehensive keymap** — Handles code blocks, table navigation, list indentation, and formatting escape sequences
- **Strong handler test coverage** — Thorough tests for inline formatting, headings, blockquotes, lists, and internal links
- **1,736 tests across 59 files** — Solid testing foundation to build on

---

*Generated 2026-02-06 from parallel review of 5 subsystems by specialized code review agents.*
