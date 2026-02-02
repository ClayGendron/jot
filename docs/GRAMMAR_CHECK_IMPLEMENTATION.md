# Grammar Check Implementation Guide

> How to re-enable and configure Harper.js grammar checking in Jot.

**Status**: Disabled (as of 2026-02-01)
**Library**: [Harper.js](https://github.com/elijah-potter/harper) - WASM-based grammar checker

---

## Why It's Disabled

Harper.js grammar checking was disabled due to:

1. **WASM loading issues in Tauri** - The default `binary` export uses `import.meta.url` which doesn't work with Tauri's asset protocol
2. **CSP configuration needed** - Requires `'wasm-unsafe-eval'` in Content Security Policy
3. **Configuration complexity** - Harper.js has many rules that need tuning for markdown/technical writing

The spell checker works independently and is fully functional.

---

## Files Involved

### Core Implementation (keep these)

| File | Purpose |
|------|---------|
| `src/lib/grammarcheck/harperInstance.ts` | Harper.js WASM initialization and API |
| `src/lib/grammarcheck/types.ts` | TypeScript types (GrammarIssue, GrammarDialect) |
| `src/lib/grammarcheck/ignoredRules.ts` | Persistent storage for ignored rules |
| `src/lib/grammarcheck/index.ts` | Public exports |
| `src/components/editor/extensions/GrammarCheck.ts` | TipTap extension |
| `src/components/editor/GrammarCheckContextMenu.tsx` | Right-click menu for fixes |

### Settings

| File | Location |
|------|----------|
| `src/lib/settings/types.ts` | `grammarCheckEnabled`, `grammarDialect` in AppearanceSettings |
| `src/components/settings/SettingsPanel.tsx` | UI toggle (may need to be added/hidden) |

### Editor Integration

All grammar check code in `src/components/editor/Editor.tsx` is commented out with the marker:
```
// Grammar check disabled - see docs/GRAMMAR_CHECK_IMPLEMENTATION.md
```

---

## Re-enabling Grammar Check

### Step 1: Fix WASM Loading

In `src/lib/grammarcheck/harperInstance.ts`, ensure you're using `binaryInlined`:

```typescript
import {
  WorkerLinter,
  binaryInlined as binary,  // <-- Use inlined WASM
  Dialect,
  // ...
} from "harper.js";
```

### Step 2: Update Tauri CSP

In `src-tauri/tauri.conf.json`, add `'wasm-unsafe-eval'` to script-src:

```json
"csp": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; ..."
```

### Step 3: Uncomment Editor Integration

In `src/components/editor/Editor.tsx`, search for "Grammar check disabled" and uncomment:

1. **Imports** (lines ~35-50):
   ```typescript
   import { GrammarCheck } from "./extensions/GrammarCheck";
   import { GrammarCheckContextMenu } from "./GrammarCheckContextMenu";
   import { loadIgnoredRules } from "@/lib/grammarcheck/ignoredRules";
   import type { GrammarDialect, GrammarIssue } from "@/lib/grammarcheck";
   ```

2. **Settings hooks** (lines ~126-132):
   ```typescript
   const grammarCheckEnabled = useSettingsStore(
     (s) => s.appearance?.grammarCheckEnabled ?? true
   );
   const grammarDialect = useSettingsStore(
     (s) => (s.appearance?.grammarDialect ?? "american") as GrammarDialect
   );
   ```

3. **Context menu state** - Add back `grammarIssue` and `"grammarcheck"` type

4. **Extension configuration** (in useEditor extensions array):
   ```typescript
   GrammarCheck.configure({
     grammarErrorClass: "grammar-error",
     dialect: grammarDialect,
     enabled: grammarCheckEnabled,
   }),
   ```

5. **Settings sync effect**:
   ```typescript
   useEffect(() => {
     if (!editor) return;
     if (grammarCheckEnabled) {
       editor.commands.enableGrammarCheck();
       editor.commands.setGrammarDialect(grammarDialect);
     } else {
       editor.commands.disableGrammarCheck();
     }
   }, [editor, grammarCheckEnabled, grammarDialect]);
   ```

6. **Context menu handler** - Uncomment grammar error detection block

7. **JSX** - Uncomment `<GrammarCheckContextMenu />` render

### Step 4: Enable by Default

In `src/lib/settings/types.ts`, change:

```typescript
grammarCheckEnabled: true,  // Was false
```

### Step 5: Add Settings UI (Optional)

Add a toggle in `src/components/settings/SettingsPanel.tsx` for grammar check enable/disable.

---

## Harper.js Configuration

### Dialects

Harper supports multiple English dialects:
- `american` (default)
- `british`
- `canadian`
- `australian`

### Ignoring Rules

Users can ignore specific rule types. Rules are stored in:
- **Memory**: `harperInstance.ts` → `ignoredRuleIds` Set
- **Disk**: `~/.jot/ignored-grammar-rules.json`

Common rules to consider ignoring for technical writing:
- `SpellCheck` - Use our own spell checker instead
- `Capitalization` - Technical terms often have unusual casing
- `RepeatedWords` - Intentional in some contexts

### Performance

Harper.js uses a Web Worker (`WorkerLinter`) to avoid blocking the UI. Grammar checking is debounced and only runs on changed paragraphs.

---

## Testing

After re-enabling:

1. **Unit tests**: `bun run test -- src/lib/grammarcheck`
2. **Manual testing**: Type text with grammar issues like:
   - "The the quick brown fox" (repeated word)
   - "She don't like it" (subject-verb agreement)
   - "Its a nice day" (it's vs its)

3. **Verify in Tauri dev**: `bun run tauri dev`
   - Open dev tools console
   - Check for WASM loading errors
   - Verify grammar errors are underlined

---

## Troubleshooting

### "WebAssembly.instantiateStreaming failed"

- Check CSP includes `'wasm-unsafe-eval'`
- Verify using `binaryInlined` not `binary`

### Grammar check not running

- Check `grammarCheckEnabled` setting
- Look for initialization errors in console
- Verify Harper.js version compatibility

### Too many false positives

- Add rules to ignored list
- Consider adjusting for markdown context
- Harper may flag code blocks inappropriately

---

## Dependencies

```json
{
  "harper.js": "^x.x.x"
}
```

Check for updates: https://github.com/elijah-potter/harper

---

*Last updated: 2026-02-01*
