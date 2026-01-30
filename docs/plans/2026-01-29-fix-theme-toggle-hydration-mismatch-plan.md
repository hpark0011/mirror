---
title: Fix ThemeToggleButton hydration mismatch
type: fix
date: 2026-01-29
---

# Fix ThemeToggleButton hydration mismatch

## Overview

The `ThemeToggleButton` component causes React hydration errors because it renders a different component tree on the server (placeholder `Button`) versus the client (full `DropdownMenu`). Radix UI generates unique IDs for dropdown elements, and when the component tree changes after hydration, these IDs mismatch.

## Problem Statement

**Error observed:**
```
A tree hydrated but some attributes of the server rendered HTML didn't match the client properties.
```

The ID mismatch:
```diff
+ id="radix-_R_1knelb_"
- id="radix-_R_9knelb_"
```

**Root cause:** The `mounted` pattern in `theme-toggle-button.tsx:23-30` renders a completely different component tree before/after mount:

- **Server/Initial render:** Plain `<Button>` with no Radix wrapper
- **After mount:** `<DropdownMenu>` containing `<Button>` with Radix-generated IDs

This violates React's hydration requirement that server and client must produce identical initial HTML.

## Proposed Solution

Render the **same component tree** on both server and client, but control interactivity via the `disabled` prop and visibility via CSS.

Key changes:
1. Always render the `DropdownMenu` wrapper
2. Use `disabled` prop on trigger when not mounted (prevents interaction)
3. Optionally use `suppressHydrationWarning` on elements with dynamic content if needed

## Acceptance Criteria

- [x] No hydration mismatch console errors on page load
- [x] Theme toggle button appears on initial render (no flash)
- [x] Theme toggle is non-interactive until mounted (prevents SSR state issues)
- [x] Dropdown menu works correctly after hydration
- [x] Theme selection (light/dark/system) functions properly

## MVP

### apps/mirror/app/ui-factory/_components/theme-toggle-button.tsx

```tsx
"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@feel-good/ui/primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@feel-good/ui/primitives/dropdown-menu";

export function ThemeToggleButton() {
  const [mounted, setMounted] = React.useState(false);
  const { setTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Always render the same component tree to avoid hydration mismatch
  // Use disabled state to prevent interaction before mount
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={!mounted}>
        <Button variant="outline" size="icon" disabled={!mounted}>
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

## Technical Considerations

### Why this works

1. **Same component tree:** Both server and client render `DropdownMenu > DropdownMenuTrigger > Button`. Radix generates consistent IDs because the component structure is identical.

2. **Disabled until mounted:** The `disabled` prop prevents users from interacting with the dropdown before `next-themes` has determined the actual theme (which requires client-side JavaScript).

3. **No visual flash:** The button is always visible, just temporarily non-interactive.

### Alternative considered: `suppressHydrationWarning`

Could add `suppressHydrationWarning` to suppress the error, but this:
- Masks the actual problem rather than fixing it
- May hide other real hydration issues
- Doesn't address the structural mismatch

The proposed solution fixes the root cause instead of suppressing symptoms.

## References

- Error documentation: https://nextjs.org/docs/messages/react-hydration-error
- Related file: `apps/mirror/app/ui-factory/_components/theme-toggle-button.tsx:23-30`
- Button component: `packages/ui/src/primitives/button.tsx`
- DropdownMenu component: `packages/ui/src/primitives/dropdown-menu.tsx`
