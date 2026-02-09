---
status: completed
priority: p2
issue_id: "119"
tags: [code-review, architecture, ui-primitives]
dependencies: []
---

# DrawerContent primitive lacks snap-point awareness

## Problem Statement

The `DrawerContent` component in `@feel-good/ui` hardcodes `max-h-[80vh]` and `mt-24` for bottom drawers via `data-[vaul-drawer-direction=bottom]:` selectors. Vaul's snap-point math (`translateY(viewportHeight - snapPointValue)`) requires the content to be full viewport height. This forces consumers to use `!important` overrides (`!h-full !max-h-none !mt-0`) to fight the primitive's own styles.

If snap-point drawers are used in mirror or greyboard, the same `!important` workaround will be copied — creating duplicated workarounds that should be a single primitive enhancement.

## Findings

- **5/5 review agents flagged this** as the primary concern
- Only 3 `!important` usages exist in the entire codebase — this adds 3 more on a single element
- Vaul already sets `data-vaul-snap-points` and `data-vaul-snap-points-overlay` on content elements, providing a built-in hook for conditional styling
- The `className` prop is appended via `cn()` but cannot override `data-[...]` selectors due to equal specificity

## Proposed Solutions

### Option A: Use vaul's data attributes in the primitive (Recommended)

Add snap-point-aware overrides to `DrawerContent` using vaul's existing data attributes:

```tsx
// In packages/ui/src/primitives/drawer.tsx DrawerContent className:
"data-[vaul-snap-points]:mt-0 data-[vaul-snap-points]:max-h-none data-[vaul-snap-points]:h-full"
```

- **Pros:** Zero API change, auto-detected via vaul's own attributes, no consumer changes needed
- **Cons:** Couples the primitive to vaul internals (though it already depends on vaul)
- **Effort:** Small (single line addition)
- **Risk:** Low

### Option B: Add a `fullHeight` prop to DrawerContent

```tsx
function DrawerContent({ fullHeight, className, children, ...props }) {
  // Conditionally omit max-h and margin when fullHeight is true
}
```

- **Pros:** Explicit opt-in, framework-agnostic
- **Cons:** API surface increase, consumer must know to pass the prop
- **Effort:** Small
- **Risk:** Low

## Technical Details

- **Affected file:** `packages/ui/src/primitives/drawer.tsx` (lines 58-63)
- **Consumer workaround:** `apps/ui-factory/app/components/drawer/_components/peeking-drawer-demo.tsx` (line 24)

## Acceptance Criteria

- [ ] Snap-point drawers render correctly without `!important` overrides from consumers
- [ ] Standard (non-snap-point) drawers are unaffected
- [ ] Build passes for ui-factory, mirror, and greyboard

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-09 | Created from code review of peeking drawer implementation | Vaul sets `data-vaul-snap-points` attribute that can be used for conditional styling |

## Resources

- Branch: `ui-factory/020926-drawer`
- Primitive: `packages/ui/src/primitives/drawer.tsx`
- Vaul snap points docs: https://github.com/emilkowalski/vaul
