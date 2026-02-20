---
status: completed
priority: p1
issue_id: "178"
tags: [greyboard-desktop, css, bug]
dependencies: []
---

# Add Windows padding-right for title bar caption buttons

## Problem Statement

`styles/globals.css` only has a macOS-specific CSS rule (`[data-platform="darwin"] .titlebar-padded { padding-left: 80px }`) to avoid overlapping traffic lights. On Windows, the native caption buttons (~138px wide) occupy the top-right corner but no `padding-right` compensates — the ThemeToggle sits directly under them.

## Findings

- **Location:** `apps/greyboard-desktop/styles/globals.css:51-53`
- **Source:** Plan `docs/plans/2026-02-20-fix-platform-conditional-titlebar.md`
- **Severity:** High — ThemeToggle is overlapped/unclickable on Windows

## Proposed Solution

```css
[data-platform="win32"] .titlebar-padded {
  padding-right: 140px;
}
```

140px clears the ~138px Windows caption button area. The `[data-platform] .class` specificity overrides Tailwind's `px-4`.

## Acceptance Criteria

- [ ] Windows: ThemeToggle is fully visible and clickable (not overlapped by caption buttons)
- [ ] macOS: no change to existing left-padding behavior
- [ ] `pnpm build --filter=@feel-good/greyboard-desktop` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from platform-conditional titlebar plan | |
