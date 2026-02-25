# Plan: Enforce Component-Ownership Convention for CSS Token Files

## Context

The three-layer token architecture (Radix → semantic → Tailwind) is sound, but the file-splitting logic has no consistent rule. Button (12 tokens) lives in `globals.css` while field (1 token) gets its own file. Three tokens skip Layer 2 entirely. This plan enforces a single decision rule and fixes all consistency violations.

**Decision rule**: A token group gets its own file when it is consumed exclusively by a single component in `src/primitives/` or `src/components/`. Tokens consumed by multiple unrelated components or applied via `@layer base` stay in `globals.css`. "Unrelated" means the components don't share a parent primitive. When in doubt, grep for the Tailwind utility — the answer is in the import graph.

## Changes

### 1. Create `button.css` — extract 12 button tokens from globals

**File**: `packages/ui/src/styles/button.css` (new)

Extract from `globals.css` all tokens under the `/* Button */` comments:
- `:root` block: `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--destructive`, `--destructive-foreground`, `--accent`, `--accent-foreground`, `--muted`, `--muted-foreground`, `--ghost`, `--ghost-foreground`
- `.dark` block: same 12 tokens
- `@theme inline` block: `--color-primary` through `--color-ghost-foreground` (12 registrations)

Add standard header comment. Add `@import "./button.css";` to globals.css imports.

### 2. Create `dialog.css` — extract dialog token from globals

**File**: `packages/ui/src/styles/dialog.css` (new)

Extract `--dialog` from globals.css `:root`, `.dark`, and `--color-dialog` from `@theme inline`. Maps to `primitives/dialog.tsx` and `primitives/alert-dialog.tsx`. Used in 4 files across greyboard and mirror.

Add standard header comment. Add `@import "./dialog.css";` to globals.css imports.

### 3. Fix `--color-icon` — add Layer 2 entries

**File**: `packages/ui/src/styles/globals.css`

Currently `--color-icon: var(--gray-8)` is defined directly in `@theme inline`, skipping Layer 2. Used across 36 files — system-level, stays in globals.

Add:
- `:root { --icon: var(--gray-8); }`
- `.dark { --icon: var(--gray-8); }` (same value — explicit for overridability)
- Change `@theme inline` to: `--color-icon: var(--icon);`

### 4. Fix `--color-resizable-handle-hover` — add Layer 2 entry

**File**: `packages/ui/src/styles/globals.css`

Currently aliases `--border-subtle` directly in `@theme inline`. Used by `primitives/resizable.tsx` and mirror's `profile-shell.tsx`. Only 1 token — stays in globals since it's an alias of a system token.

Add:
- `:root { --resizable-handle-hover: var(--border-subtle); }`
- `.dark { --resizable-handle-hover: var(--border-subtle); }`
- Change `@theme inline` to: `--color-resizable-handle-hover: var(--resizable-handle-hover);`

### 5. Fix Swiss sidebar tokens — add Layer 2 entries

**File**: `packages/ui/src/styles/sidebar.css`

Currently 4 Swiss tokens are hardcoded directly in `@theme inline`, skipping Layer 2.

Add to `:root` and `.dark` blocks:
- `--swiss-sidebar-button-background: transparent;`
- `--swiss-sidebar-button-foreground: var(--gray-10);`
- `--swiss-sidebar-button-accent: transparent;`
- `--swiss-sidebar-button-accent-foreground: var(--gray-12);`

Change `@theme inline` to reference `var(--swiss-sidebar-*)` instead of hardcoded values.

### 6. Add header comment to `shadows.css`

**File**: `packages/ui/src/styles/shadows.css`

Add standard header matching the other files:
```css
/*
* shadows.css
*
* Shadow-specific styles and CSS variables
*/
```

### 7. Keep `--information` in globals

Used across mirror and the editor package — not component-specific. Stays in globals under `/* Text */` comment. No change needed.

### 8. Keep `--caret` naming as-is

Renaming `--caret` → `--input-caret` would change the Tailwind utility from `caret-caret` to `caret-input-caret`, making usage worse. The current name is pragmatically fine.

### 9. Update AGENTS.md with the decision rule

**File**: `packages/ui/AGENTS.md`

Add a "Style File Convention" section documenting:
- The component-ownership rule
- When to create a new file vs keep in globals
- The three-layer contract (all tokens must flow through `:root`/`.dark` → `@theme inline`)

### 10. Update globals.css — remove extracted tokens, add imports

**File**: `packages/ui/src/styles/globals.css`

- Add `@import "./button.css";` and `@import "./dialog.css";` to the import block
- Remove all `/* Button */` entries from `:root`, `.dark`, and `@theme inline`
- Remove `/* Dialog */` entries from `:root`, `.dark`, and `@theme inline`
- Add Layer 2 entries for `--icon` and `--resizable-handle-hover` to `:root` and `.dark`
- Fix `@theme inline` references for icon and resizable-handle-hover

## Files Modified

| File | Action |
|---|---|
| `packages/ui/src/styles/button.css` | **Create** — 12 button tokens |
| `packages/ui/src/styles/dialog.css` | **Create** — 1 dialog token |
| `packages/ui/src/styles/globals.css` | **Edit** — remove extracted tokens, add imports, fix Layer 2 skips |
| `packages/ui/src/styles/sidebar.css` | **Edit** — add Layer 2 entries for Swiss tokens |
| `packages/ui/src/styles/shadows.css` | **Edit** — add header comment |
| `packages/ui/AGENTS.md` | **Edit** — add decision rule section |

No component files change. No Tailwind utility class names change. All `@theme inline` registrations keep the same `--color-*` names, so consuming code is unaffected.

## Verification

1. `pnpm --filter=@feel-good/ui exec tsc --noEmit` — typecheck
2. `pnpm build --filter=@feel-good/ui-factory` — build a consuming app to verify CSS loads correctly
3. Grep for all extracted token names to confirm no dangling references in globals.css
4. Run the `@theme inline` lint guard from `docs/conventions/css-token-file-convention.md` to confirm zero direct values in Layer 3:
   ```bash
   awk '/@theme inline/{b=1;next} b&&/\}/{b=0;next} b&&/--[a-zA-Z].*:/&&!/var[(]/{printf "%s:%d: %s\n",FILENAME,FNR,$0;v++} END{exit(v>0)}' packages/ui/src/styles/*.css
   ```
