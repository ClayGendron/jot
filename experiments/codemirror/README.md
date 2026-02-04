# CodeMirror Experiments

Isolated experiments for testing CodeMirror 6 WYSIWYG patterns before migration.

## Why Experiments First?

The previous migration attempt (Phases 1-9) failed because:

1. **atomicRanges made content uneditable** - Used to prevent cursor entering syntax markers, but accidentally blocked all editing
2. **Widgets replaced editable text** - Some elements used widgets when marks would have worked better
3. **Too many changes at once** - Hard to isolate which pattern caused issues

These experiments test each pattern in isolation.

## Experiment 1: Hidden Syntax (No atomicRanges)

**Goal:** Verify that hiding syntax markers with `Decoration.replace()` keeps text editable when we DON'T use `atomicRanges`.

**Run:**
```bash
bun experiments/codemirror/run.ts
```

**What to test:**
- Cursor movement through bold/italic text
- Typing inside formatted text
- Selecting and deleting formatted text
- Backspace at start of formatted text
- Undo/Redo

**Key insight:** The failed migration used:
```typescript
provide: (f) => [
  EditorView.decorations.from(f),
  EditorView.atomicRanges.of((view) => view.state.field(f)),  // <-- PROBLEM
]
```

This experiment only provides decorations, NOT atomicRanges.

## Experiment 2: Widgets vs Marks (TODO)

Compare approaches for complex elements like links.

## Experiment 3: Table Editing (TODO)

Test table widgets in isolation.

## Experiment 4: Raw-When-Focused (TODO)

Test the pattern where content shows raw markdown when cursor is inside.

## Structure

```
experiments/codemirror/
├── README.md              # This file
├── run.ts                 # Start experiment server
├── generate-fixtures.ts   # Regenerate test markdown files
├── vite.config.ts         # Vite config for experiments
├── index.html             # Entry point
├── harness.tsx            # Experiment UI
└── fixtures/              # Generated test markdown files
    ├── bold-asterisks.md
    ├── italic-asterisks.md
    ├── ...
    └── README.md
```
