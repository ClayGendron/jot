# Migration Plan: shadcn/ui + Base UI for Jot

## Overview

Two-part migration:

1.  **Add shadcn/ui with Base UI** - Replace custom UI components with accessible primitives
    
2.  **CSS Reorganization** - Split 7,000+ line monolith into modular structure with Tailwind utilities
    

## Migration Status

| Phase | Status | Commit |
| --- | --- | --- |
| Phase 1: Foundation Setup | ✅ Complete | `9797d17`, `f664687` |
| Phase 2: Tier 1 Components | ⏳ Pending | - |
| Phase 3: Tier 2 Components | ⏳ Pending | - |
| Phase 4: Tier 3 Components | ⏳ Pending | - |
| Phase 5: Final CSS Cleanup | ⏳ Pending | - |

## Current State

| Aspect | Status |
| --- | --- |
| React | 19.1.0 |
| Tailwind | v4 with `@tailwindcss/vite` (CSS-first, `@theme` directive) |
| Path alias | `@/` already configured |
| Theme system | 5 presets (Paper, Midnight, Sepia, High Contrast, Olive) + custom accent colors |
| Component library | shadcn/ui with Base UI primitives (Phase 1 complete) |
| Icons | Lucide React (consolidated from ~100 inline SVGs) |
| CSS structure | Modular (theme.css, editor.css, legacy-components.css) |

## Why Base UI over Radix

-   Built-in multi-select, combobox, autocomplete (Radix lacks these)
    
-   Single package vs. multiple `@radix-ui/*` packages
    
-   Active development (Radix stalled after WorkOS acquisition)
    
-   v1.0 stable released December 2025
    
-   Native shadcn/ui support as of December 2025
    

## CSS Strategy: Pragmatic Hybrid

Split `src/index.css` (7,115 lines) into:

| File | Content | Approach |
| --- | --- | --- |
| `src/styles/theme.css` | CSS variables, `@theme` block, theme presets | Keep as CSS |
| `src/styles/editor.css` | TipTap/ProseMirror styles (complex nested selectors) | Keep as CSS |
| `src/styles/legacy-components.css` | **All existing component styles** | Delete incrementally per-component |
| `src/styles/index.css` | Imports only | Entry point for Vite |

**Why this split:**

-   Theme variables must be CSS (Tailwind uses them via `var()`)
    
-   Editor styles have complex selectors (`.ProseMirror blockquote > p`) that can’t be Tailwind
    
-   Legacy component styles stay intact until each component is migrated (avoids breaking UI)
    
-   Everything migrated becomes Tailwind utilities for consistency with shadcn/ui
    

---

## Phase 1: Foundation Setup ✅ Complete

### 1.1 Split CSS Files ✅

Create new directory structure:

```plaintext
src/styles/
├── theme.css              # CSS variables, @theme block, theme presets (~150 lines)
├── editor.css             # TipTap/ProseMirror styles (~1,500 lines)
├── legacy-components.css  # All existing component styles (~5,400 lines)
└── index.css              # Just imports (see below)

```

**Create** `src/styles/index.css`**:**

```css
/* Tailwind base - must be first and only once */
@import "tailwindcss";

/* Theme variables and presets */
@import "./theme.css";

/* TipTap/ProseMirror editor styles */
@import "./editor.css";

/* Legacy component styles - delete sections as components migrate */
@import "./legacy-components.css";

```

**Extract from current index.css:**

-   Lines 1-143 → `theme.css` (remove `@import "tailwindcss"` - it goes in index.css)
    
-   TipTap `.ProseMirror` styles → `editor.css`
    
-   **Everything else** → `legacy-components.css` (DO NOT DELETE YET)
    

**Critical:** The `@import "tailwindcss"` must appear exactly once, in `index.css`, before all other imports.

**Completed:** CSS split into 4 files totaling ~7,100 lines (theme: 230, editor: 300, legacy-components: 6,582, index: 18).

### 1.2 Initialize shadcn/ui ✅

```bash
bunx --bun shadcn@latest create

```

Select during prompts:

-   Primitive library: **Base UI**
    
-   Style: Custom
    
-   CSS variables: Yes
    
-   Global CSS location: `src/styles/index.css`
    
-   Import alias: `@/`
    

This creates:

-   `components.json` - shadcn configuration
    
-   `src/components/ui/` - Component directory
    
-   `src/lib/utils.ts` - `cn()` helper function

**Completed:** Used Base UI style (`"style": "base-nova"` in components.json). Created with 13 base components.

### 1.3 Install Dependencies ✅

shadcn CLI will install:

-   `@base-ui-components/react` - Base UI primitives
    
-   `tailwind-merge` - Merges Tailwind classes
    
-   `class-variance-authority` - Variant management

**Completed:** Installed @base-ui-components/react, tailwind-merge, class-variance-authority, clsx, shadcn, tw-animate-css.

### 1.4 Theme Integration ✅

Add shadcn CSS variable mappings to `src/styles/theme.css` (after the theme presets):

```css
/* ========================================================================
   shadcn/ui Compatibility Layer
   Maps Jot's semantic tokens to shadcn's expected variable names.

   IMPORTANT: All theme presets MUST set --color-* variables (not direct colors).
   shadcn components read these mapped variables, which reference --color-*.
   ======================================================================== */

:root {
  /* Surface colors */
  --background: var(--color-paper);
  --foreground: var(--color-ink);
  --muted: var(--color-paper-warm);
  --muted-foreground: var(--color-ink-muted);

  /* Popover/Card surfaces */
  --popover: var(--color-paper);
  --popover-foreground: var(--color-ink);
  --card: var(--color-paper);
  --card-foreground: var(--color-ink);

  /* Borders and inputs */
  --border: var(--color-border);
  --input: var(--color-border);
  --ring: var(--color-accent);

  /* Primary action color */
  --primary: var(--color-accent);
  --primary-foreground: #ffffff;

  /* Secondary elements */
  --secondary: var(--color-paper-warm);
  --secondary-foreground: var(--color-ink);

  /* Accent highlights */
  --accent: var(--color-accent-soft);
  --accent-foreground: var(--color-ink);

  /* Destructive actions */
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;

  /* Border radius */
  --radius: 6px;
}

/* High Contrast theme overrides for WCAG compliance */
html[data-theme="highContrast"] {
  --primary-foreground: #ffffff;
  --destructive: #cc0000;
}

```

**Theme Preset Requirement:** All 5 theme presets must set `--color-*` variables (not direct colors). This is already the case in the current `index.css` - verified.

**Completed:** Added shadcn compatibility layer mapping Jot tokens to shadcn variables. Added Tailwind v4 `@theme inline` block for color utilities.

### 1.5 Consolidate Icons to Lucide ✅

Replace inline SVG icons with Lucide React components across all files.

**Files to update:**

-   `src/components/editor/ThemeStyleDropdown.tsx` - Sun, Moon, Monitor
    
-   `src/components/semantic/SemanticSetupDialog.tsx` - Brain, Check, Folder, X, Plus, Shield
    
-   `src/components/editor/SpellCheckContextMenu.tsx` - XCircle, BookPlus, SkipForward
    
-   `src/components/editor/GrammarCheckContextMenu.tsx` - (similar pattern)
    
-   `src/components/settings/SettingsPanel.tsx`
    

**Find all inline icons:**

```bash
grep -r "function.*Icon\(\)" src/components/ --include="*.tsx"

```

**Migration pattern:**

```tsx
// Before (inline SVG - ~15 lines)
function SunIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" ...>...</svg>;
}

// After (Lucide - 1 line)
import { Sun, Moon, Monitor } from "lucide-react";
// Usage: <Sun className="h-4 w-4" />

```

**Completed:** Migrated ~100 inline SVG icons to Lucide React across 25+ files. Retained 5 custom icons without Lucide equivalents (RelatedDocsTabIcon, PdfIcon, DocxIcon, OrientationPortraitIcon, OrientationLandscapeIcon).

### 1.6 Update Vite Entry Point ✅

Update `src/main.tsx`:

```tsx
import "./styles/index.css";

```

**Completed:** Updated `src/App.tsx` to import from `./styles/index.css`.

### 1.7 Verification ✅

-   `bun run typecheck` passes
    
-   `bun run test -- --run` passes
    
-   `cd src-tauri && cargo build` succeeds
    
-   `bun run build` succeeds
    
-   Record baseline bundle size: `ls -la dist/assets/*.js`
    
-   Theme switching works (Paper/Midnight/Sepia/High Contrast/Olive)
    
-   Custom accent colors apply correctly
    
-   App starts without errors
    
-   Editor renders correctly (ProseMirror styles intact)
    
-   No duplicate Tailwind resets in dev tools

**Completed (2025-02-02):**
- All 930 tests pass
- TypeScript compiles without errors
- Production build succeeds (main bundle: 2,054 KB / 659 KB gzipped)
- Rust backend builds successfully
- Code review passed

---

## Phase 2: Tier 1 Components (High Value)

These eliminate the most boilerplate and provide immediate value.

**Per-Component Migration Process:**

1.  Add shadcn component
    
2.  Update component to use shadcn primitives + Tailwind utilities
    
3.  Update or rewrite component tests
    
4.  **Audit CSS usage** before deletion (see 2.0)
    
5.  Delete old CSS from `legacy-components.css`
    
6.  Verify all 5 themes display correctly
    

### 2.0 CSS Deletion Protocol

**Before deleting any CSS class from** `legacy-components.css`**:**

```bash
# Check if class is used elsewhere
rg "toolbar-button" src/components/
rg "toolbar-button" src/styles/

```

**Only delete when:**

-   Zero matches in `src/components/`
    
-   No dependent selectors in CSS files
    
-   Visual verification in all 5 themes passes
    

### 2.1 Button

```bash
bunx shadcn@latest add button

```

**Customize** `src/components/ui/button.tsx` **variants:**

| Current Class | shadcn Variant |
| --- | --- |
| `toolbar-button` | `variant="ghost" size="icon"` |
| `semantic-setup-btn-primary` | `variant="default"` |
| `semantic-setup-btn-secondary` | `variant="outline"` |
| `semantic-setup-btn-ghost` | `variant="ghost"` |

**Migration targets:**

-   `src/components/editor/EditorToolbar.tsx`
    
-   `src/components/semantic/SemanticSetupDialog.tsx`
    
-   `src/components/settings/SettingsPanel.tsx`
    
-   `src/components/export/ExportPanel.tsx`
    

**Testing:**

-   Update tests if they reference CSS classes
    
-   Verify button focus states are visible
    
-   Test keyboard navigation through toolbar
    

**CSS to delete:** `.toolbar-button`, `.semantic-setup-btn-*` (~50 lines)

### 2.2 Dialog

```bash
bunx shadcn@latest add dialog

```

**Migration target:** `src/components/semantic/SemanticSetupDialog.tsx`

**Accessibility improvements gained:**

-   Focus trap (Tab stays within dialog)
    
-   Escape key handling (built-in)
    
-   Click outside to close (built-in)
    
-   Portal to body (avoids z-index issues)
    
-   `aria-modal="true"` (built-in)
    

**Migration:**

```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function SemanticSetupDialog({ isOpen, onClose, onComplete }: Props) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Semantic Search</DialogTitle>
          <DialogDescription>
            Find documents by meaning, not just keywords.
          </DialogDescription>
        </DialogHeader>
        {/* Rest of content with Tailwind utilities */}
      </DialogContent>
    </Dialog>
  );
}

```

**Testing:**

-   Focus trap works (Tab cycles within dialog)
    
-   Escape key closes dialog
    
-   Click outside closes dialog
    
-   Screen reader announces dialog
    

**CSS to delete:** `.semantic-setup-overlay`, `.semantic-setup-dialog`, `.semantic-setup-*` (~80 lines)

### 2.3 DropdownMenu

```bash
bunx shadcn@latest add dropdown-menu

```

**Migration targets (trigger-based dropdowns only):**

-   `src/components/editor/ThemeStyleDropdown.tsx`
    
-   `src/components/sidebar/SortDropdown.tsx`
    
-   `src/components/workspace/RecentWorkspacesMenu.tsx`
    

**Boilerplate eliminated per component:**

-   Click-outside detection useEffect (~10 lines)
    
-   Escape key handling useEffect (~10 lines)
    
-   Manual isOpen state management (~5 lines)
    
-   Ref for outside click detection (~3 lines)
    

**Migration example for ThemeStyleDropdown:**

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeStyleDropdown() {
  const theme = useEditorStore((s) => s.theme);
  // ... other state

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Appearance settings">
          {theme === "light" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleThemeSelect("light")}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        {/* ... more items */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

```

**Testing:**

-   Update `ThemeStyleDropdown.test.tsx`
    
-   Arrow key navigation works
    
-   Enter selects item
    
-   Escape closes menu
    
-   Menu doesn’t overflow viewport
    

**CSS to delete:** `.theme-dropdown-*`, `.sort-dropdown-*`, `.recent-workspaces-*` (~100 lines)

### 2.4 Input

```bash
bunx shadcn@latest add input

```

**Migration targets:**

-   Export panel margin inputs
    
-   Outline filter input
    
-   Find/replace inputs
    
-   Global search input
    

**CSS to delete:** Form input styles (~30 lines)

### 2.5 Switch

```bash
bunx shadcn@latest add switch

```

**Migration target:** `src/components/settings/SettingsPanel.tsx`

**Toggles to migrate:**

-   Spell check enabled
    
-   Grammar check enabled
    
-   Typewriter mode
    
-   Focus mode
    
-   Line numbers
    

**CSS to delete:** `.settings-toggle`, toggle styles (~40 lines)

---

## Phase 3: Tier 2 Components (Medium Value)

### 3.1 Select

```bash
bunx shadcn@latest add select

```

**Migration targets:**

-   Page size selection in ExportPanel (Letter, A4, Legal)
    
-   Format selection (PDF, Word)
    
-   Language/dialect selectors in SettingsPanel
    
-   Font family selector
    

### 3.2 Positioned Menus (Custom Components)

**These menus position at cursor coordinates and cannot use shadcn DropdownMenu (which requires a trigger element):**

-   `src/components/editor/SpellCheckContextMenu.tsx`
    
-   `src/components/editor/GrammarCheckContextMenu.tsx`
    
-   `src/components/editor/EditorContextMenu.tsx`
    
-   `src/components/tabs/TabContextMenu.tsx`
    

**Migration approach:**

1.  **Create shared hook** `src/hooks/usePositionedMenu.ts`:
    

```tsx
import { useEffect, useRef } from "react";

interface UsePositionedMenuOptions {
  onDismiss: () => void;
}

export function usePositionedMenu({ onDismiss }: UsePositionedMenuOptions) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onDismiss]);

  return menuRef;
}

```

2.  **Create shared menu styling component** `src/components/ui/positioned-menu.tsx`:
    

```tsx
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface PositionedMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  position: { x: number; y: number };
}

export const PositionedMenu = forwardRef<HTMLDivElement, PositionedMenuProps>(
  ({ position, className, children, ...props }, ref) => {
    const adjusted = {
      x: Math.min(position.x, window.innerWidth - 200),
      y: Math.min(position.y, window.innerHeight - 300),
    };

    return (
      <div
        ref={ref}
        role="menu"
        className={cn(
          "fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
          "animate-in fade-in-0 zoom-in-95",
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

export const PositionedMenuItem = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    role="menuitem"
    className={cn(
      "flex w-full items-center rounded-sm px-2 py-1.5 text-sm outline-none",
      "hover:bg-accent hover:text-accent-foreground",
      "focus:bg-accent focus:text-accent-foreground",
      className
    )}
    {...props}
  />
));

export const PositionedMenuSeparator = () => (
  <div className="my-1 h-px bg-border" />
);

```

3.  **Migrate each context menu:**
    

```tsx
// SpellCheckContextMenu.tsx
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import { PositionedMenu, PositionedMenuItem, PositionedMenuSeparator } from "@/components/ui/positioned-menu";
import { BookPlus, SkipForward, XCircle } from "lucide-react";

export function SpellCheckContextMenu({ position, word, onDismiss, ... }: Props) {
  const menuRef = usePositionedMenu({ onDismiss });

  return (
    <PositionedMenu ref={menuRef} position={position}>
      <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
        <XCircle className="h-4 w-4 text-destructive" />
        <span className="font-medium">{word}</span>
      </div>
      <PositionedMenuSeparator />
      {suggestions.map((s) => (
        <PositionedMenuItem key={s} onClick={() => handleSuggestionClick(s)}>
          {s}
        </PositionedMenuItem>
      ))}
      <PositionedMenuSeparator />
      <PositionedMenuItem onClick={handleAddToDictionary}>
        <BookPlus className="mr-2 h-4 w-4" />
        Add to Dictionary
      </PositionedMenuItem>
      <PositionedMenuItem onClick={handleIgnore}>
        <SkipForward className="mr-2 h-4 w-4" />
        Ignore
      </PositionedMenuItem>
    </PositionedMenu>
  );
}

```

**CSS to delete:** `.spell-context-menu-*`, `.tab-context-menu-*`, `.editor-context-menu-*`, `.grammar-context-menu-*` (~120 lines)

### 3.3 Progress

```bash
bunx shadcn@latest add progress

```

**Migration target:** `src/components/semantic/IndexingProgress.tsx`

---

## Phase 4: Tier 3 Components (Nice to Have)

### 4.1 Sheet

```bash
bunx shadcn@latest add sheet

```

**Migration targets:**

-   `src/components/settings/SettingsPanel.tsx` (slide-out panel)
    
-   `src/components/export/ExportPanel.tsx` (slide-out panel)
    

### 4.2 Tooltip

```bash
bunx shadcn@latest add tooltip

```

**Migration target:** Toolbar button tooltips

Replace `title` attributes with proper accessible tooltips:

```tsx
// Before
<Button title="Bold (Cmd+B)">B</Button>

// After
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button>B</Button>
    </TooltipTrigger>
    <TooltipContent>
      <p>Bold</p>
      <kbd className="ml-2 text-xs text-muted-foreground">Cmd+B</kbd>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>

```

### 4.3 RadioGroup

```bash
bunx shadcn@latest add radio-group

```

**Migration targets:**

-   Theme picker cards in SettingsPanel
    
-   Export format selection
    

---

## Phase 5: Final CSS Cleanup

### 5.1 Verify CSS File Sizes

Target state:

-   `src/styles/theme.css` - ~200 lines
    
-   `src/styles/editor.css` - ~1,500 lines
    
-   `src/styles/legacy-components.css` - **0 lines** (delete file)
    
-   Total: ~1,700 lines (down from 7,115)
    

### 5.2 Audit for Orphaned Styles

```bash
# Find remaining classes in legacy-components.css
grep -oE '\.[a-z][a-z0-9-]+' src/styles/legacy-components.css | sort -u > /tmp/css-classes.txt

# Check each against codebase
while read class; do
  if ! rg -q "${class#.}" src/components/; then
    echo "ORPHANED: $class"
  fi
done < /tmp/css-classes.txt

```

### 5.3 Delete Legacy File

1.  Remove `@import "./legacy-components.css"` from `index.css`
    
2.  Delete `src/styles/legacy-components.css`
    

### 5.4 Final Verification

-   `bun run build` - Compare bundle size to Phase 1 baseline
    
-   All 5 themes render correctly
    
-   All components accessible via keyboard
    
-   All tests pass
    
-   No console warnings about missing styles
    

---

## Critical Files

| File | Purpose |
| --- | --- |
| `src/index.css` | Current monolith - will be split |
| `src/styles/index.css` | New entry point (imports only) |
| `src/styles/theme.css` | Theme variables + shadcn mappings |
| `src/styles/editor.css` | TipTap styles |
| `src/styles/legacy-components.css` | Temporary home for old styles |
| `src/components/ui/button.tsx` | shadcn Button |
| `src/components/ui/positioned-menu.tsx` | Custom component for cursor-positioned menus |
| `src/hooks/usePositionedMenu.ts` | Shared hook for positioned menu behavior |
| `components.json` | shadcn configuration |
| `src/lib/utils.ts` | cn() helper |

---

## Testing Strategy

### Per-Component Testing

Each component migration must include:

1.  **Unit tests** - Update tests for new component API
    
2.  **Snapshot tests** - Update if component structure changed
    
3.  **Accessibility** - Verify ARIA attributes, focus management
    
4.  **Visual** - Manual check in all 5 themes + custom accent color
    

### Test Commands

```bash
bun run test -- --run                                    # All tests
bun run test -- --run src/components/editor/ThemeStyleDropdown.test.tsx  # Specific
bun run test -- --run --update                           # Update snapshots

```

---

## Implementation Order

1.  **Phase 1.1**: Split CSS files (theme.css, editor.css, legacy-components.css)
    
2.  **Phase 1.2-1.4**: Initialize shadcn/ui + theme integration
    
3.  **Phase 1.5**: Consolidate icons to Lucide
    
4.  **Phase 1.6-1.7**: Update imports + verification
    
5.  **Phase 2.1**: Button + delete old CSS
    
6.  **Phase 2.2**: Dialog (SemanticSetupDialog) + delete old CSS
    
7.  **Phase 2.3**: DropdownMenu (ThemeStyleDropdown, SortDropdown, RecentWorkspacesMenu) + delete old CSS
    
8.  **Phase 2.4**: Input + delete old CSS
    
9.  **Phase 2.5**: Switch + delete old CSS
    
10.  **Phase 3.1**: Select + delete old CSS
     
11.  **Phase 3.2**: Positioned menus (create shared hook + component, migrate 4 menus) + delete old CSS
     
12.  **Phase 3.3**: Progress + delete old CSS
     
13.  **Phase 4.1**: Sheet + delete old CSS
     
14.  **Phase 4.2**: Tooltip + delete old CSS
     
15.  **Phase 4.3**: RadioGroup + delete old CSS
     
16.  **Phase 5**: Final audit and cleanup
     

---

## Documentation Updates

After migration, add to `CLAUDE.md`:

```markdown
## UI Component Patterns

### Adding shadcn Components

\`\`\`bash
bunx shadcn@latest add <component-name>
\`\`\`

Components install to `src/components/ui/` and can be customized.

### Styling Conventions

- **shadcn components**: Tailwind utilities via `className`
- **TipTap/editor styles**: `src/styles/editor.css`
- **Theme variables**: `src/styles/theme.css`
- **Never add CSS classes**: Use Tailwind utilities

### Icons

Use Lucide React:
\`\`\`tsx
import { Sun, Moon, Settings } from "lucide-react";
<Sun className="h-4 w-4" />
\`\`\`

### Positioned Menus

For menus that appear at cursor coordinates (spell check, context menus):
\`\`\`tsx
import { usePositionedMenu } from "@/hooks/usePositionedMenu";
import { PositionedMenu, PositionedMenuItem } from "@/components/ui/positioned-menu";
\`\`\`

```

---

## Notes

-   **Tailwind v4**: shadcn/ui supports CSS-first `@theme` directive
    
-   **Base UI**: v1.0 stable, native shadcn support confirmed December 2025
    
-   **Preserve aesthetic**: Customize shadcn to match warm paper tones, serif fonts
    
-   **Incremental**: Both systems coexist during migration
    
-   **CSS reduction**: 7,115 → ~1,700 lines (76% reduction)
    
-   **Delete CSS incrementally**: After each component, audit then delete