---
title: Refactor Theme Toggle to Switch Interface
type: refactor
date: 2026-01-30
app: ui-factory
---

# Refactor Theme Toggle to Switch Interface

## Overview

Convert the UI Factory theme toggle from a dropdown menu with three options (Light, Dark, System) to a binary switch interface with only Light and Dark modes.

## Problem Statement

The current dropdown interface:
- Requires two clicks to change theme (click to open menu, click to select option)
- Includes "System" mode which may be unnecessary for this design-focused tool
- Uses more visual space than needed for a simple binary choice

A switch provides faster, single-click toggling between two states.

## Proposed Solution

Replace `ThemeToggleButton` with a switch-based component:
- Sun icon on left, Switch in middle, Moon icon on right
- Switch checked (ON) = Dark mode
- Switch unchecked (OFF) = Light mode
- Migrate existing "system" preference users to their OS-resolved theme

## Technical Approach

### Files to Modify

| File | Change |
|------|--------|
| `apps/ui-factory/app/_components/theme-toggle-button.tsx` | Replace dropdown with Switch component |
| `apps/ui-factory/providers/root-provider.tsx` | Update ThemeProvider config |

### Implementation Details

**1. Theme Toggle Component** (`apps/ui-factory/app/_components/theme-toggle-button.tsx`)

Current implementation uses:
- `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`
- `Button` with animated Sun/Moon icons
- `setTheme()` from `useTheme()`

New implementation will use:
- `Switch` from `@feel-good/ui/primitives/switch`
- Static Sun/Moon icons on either side
- `resolvedTheme` and `setTheme()` from `useTheme()`

```tsx
// Pseudo-code for new implementation
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { Switch } from "@feel-good/ui/primitives/switch";

export function ThemeToggleButton() {
  const [mounted, setMounted] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  const handleToggle = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  // Prevent hydration mismatch - render placeholder with same dimensions
  if (!mounted) {
    return <div className="flex items-center gap-2 h-5 w-20" />;
  }

  return (
    <div className="flex items-center gap-2">
      <Sun className="h-4 w-4 text-muted-foreground" />
      <Switch
        checked={isDark}
        onCheckedChange={handleToggle}
        aria-label="Toggle dark mode"
      />
      <Moon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}
```

**2. ThemeProvider Configuration** (`apps/ui-factory/providers/root-provider.tsx`)

Update to remove system mode:

```tsx
// Before
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>

// After
<ThemeProvider
  attribute="class"
  defaultTheme="light"
  disableTransitionOnChange
>
```

### Migration Strategy

Users with `theme: "system"` in localStorage:
- `next-themes` with `enableSystem` removed will no longer resolve "system" to OS preference
- However, `resolvedTheme` will still return the actual rendered theme on first load
- The first toggle action will write either "light" or "dark" to localStorage, completing migration
- No explicit migration code needed - handled naturally by the component

**Verification**: When `enableSystem` is false and stored value is "system", next-themes falls back to `defaultTheme` ("light"). The user sees light mode and their first toggle stores their actual preference.

## Acceptance Criteria

- [x] Theme toggle uses Switch component instead of dropdown
- [x] Sun icon displays on left of switch
- [x] Moon icon displays on right of switch
- [x] Switch checked state corresponds to dark mode
- [x] Switch unchecked state corresponds to light mode
- [x] Single click toggles theme immediately
- [x] Theme persists across page refreshes
- [x] No hydration mismatch errors
- [x] Accessible: proper aria-label, keyboard operable (Space/Enter)
- [x] ThemeProvider no longer has `enableSystem` prop
- [x] Default theme for new users is "light"

## Testing Plan

1. **New user flow**: Clear localStorage, visit page → should see light mode, switch unchecked
2. **Existing light user**: Has "light" stored → should see light mode, switch unchecked
3. **Existing dark user**: Has "dark" stored → should see dark mode, switch checked
4. **Existing system user**: Has "system" stored → should see light mode (default), switch unchecked
5. **Toggle functionality**: Click switch → theme changes immediately, localStorage updates
6. **Keyboard**: Tab to switch, press Space → theme toggles
7. **Screen reader**: Announces "Toggle dark mode, switch, off/on"

## References

### Internal References
- Current implementation: `apps/ui-factory/app/_components/theme-toggle-button.tsx`
- Switch component: `packages/ui/src/primitives/switch.tsx`
- ThemeProvider: `apps/ui-factory/providers/root-provider.tsx`
- Similar pattern: `apps/greyboard/app/(protected)/dashboard/tasks/_components/tasks-header.tsx:61-64`

### Institutional Learnings
- Provider architecture: `docs/solutions/architecture-patterns/provider-separation-of-concerns.md`
- `disableTransitionOnChange` prevents layout shifts during theme changes
