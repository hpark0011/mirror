---
status: completed
priority: p2
issue_id: "177"
tags: [greyboard-desktop, renderer, deprecation]
dependencies: ["175"]
---

# Replace `navigator.platform` with preload-sourced platform value

## Problem Statement

`src/main.tsx` uses the deprecated `navigator.platform` API to detect the platform, collapsing all non-Mac systems to `'win32'`. This is unreliable and semantically wrong for Linux. The preload now exposes the real `process.platform` synchronously (after #175).

## Findings

- **Location:** `apps/greyboard-desktop/src/main.tsx:9-12`
- **Source:** Plan `docs/plans/2026-02-20-fix-platform-conditional-titlebar.md`

## Proposed Solution

```typescript
function initPlatform() {
  const platform = window.greyboardDesktop?.platform ?? 'unknown'
  document.documentElement.dataset.platform = platform
}
```

Falls back to `'unknown'` if the preload API isn't available (safe degradation — no platform padding applied).

## Acceptance Criteria

- [ ] `document.documentElement.dataset.platform` reflects actual `process.platform`
- [ ] No reference to `navigator.platform` remains
- [ ] Graceful fallback if `window.greyboardDesktop` is undefined

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-20 | Created from platform-conditional titlebar plan | |
