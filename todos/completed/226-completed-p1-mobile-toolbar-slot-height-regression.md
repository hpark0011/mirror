---
status: completed
priority: p1
issue_id: "226"
tags: [code-review, regression, mobile, layout, mirror]
dependencies: []
---

# Mobile Content Viewport Breaks with Toolbar Slot Sibling

## Problem Statement

In mobile profile layout, `ToolbarSlotTarget` is rendered as a sibling of the article content. The container in `mobile-profile-layout.tsx` applies `*:h-full`, so both siblings get full height. This can clip or push the article list under an overflow-hidden container and break expected mobile scrolling behavior.

## Findings

- **Location:** `apps/mirror/app/[username]/_components/profile-shell.tsx:53`
- **Related layout rule:** `apps/mirror/features/profile/views/mobile-profile-layout.tsx:87`
- **Source:** PR #121 code review finding (P1)

## Proposed Solutions

Prefer explicit layout ownership for the toolbar slot + content region:

```tsx
<div className="flex h-full min-h-0 flex-col">
  <ToolbarSlotTarget />
  <div className="flex-1 min-h-0">
    {/* ViewTransition + scroll container */}
  </div>
</div>
```

Alternative: remove wildcard `*:h-full` from the mobile content wrapper and assign `h-full` only to the content subtree that should fill the drawer viewport.

- **Effort:** Small

## Acceptance Criteria

- [ ] Mobile article list remains fully visible and scrollable on `/<username>`
- [ ] Toolbar content renders without shrinking or clipping list viewport
- [ ] Mobile article detail toolbar (`Back`) renders correctly without layout regression
- [ ] `pnpm --filter @feel-good/mirror lint` passes
- [ ] `pnpm --filter @feel-good/mirror exec tsc --noEmit` passes

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created issue ticket from PR #121 review finding | Root cause is `ToolbarSlotTarget` + wildcard full-height sibling layout interaction |
