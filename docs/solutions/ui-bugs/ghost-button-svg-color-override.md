# Ghost Button `[&_svg]:text-icon` Overrides Icon Color Classes

## Problem

Conditionally applying a color class (e.g. `text-information`) directly on an `<Icon>` inside a ghost `<Button>` has no visible effect. The icon stays its default color.

**Symptom**: `className={cn(open && "text-information")}` on `<Icon>` renders the class in the DOM but the color doesn't change.

## Root Cause

The Button's `ghost` variant includes a descendant selector that targets child SVGs:

```
[&_svg]:text-icon
```

This compiles to `.button svg { color: var(--color-icon) }` — a **descendant combinator** selector. A simple utility class on the SVG element itself (`.text-information`) has lower CSS specificity than the parent's descendant selector, so the Button's color always wins.

**Specificity comparison:**
- `[&_svg]:text-icon` → `.btn svg` → specificity: (0, 1, 1)
- `text-information` → `.text-information` → specificity: (0, 1, 0)

## Solution

Apply the override at the **same specificity level** — on the Button's `className` using the same `[&_svg]:` prefix. Since Button merges its className via `cn(buttonVariants({ variant, size, className }))`, `twMerge` correctly resolves conflicting `[&_svg]:text-*` classes.

```tsx
// Correct: override at the Button level
<Button
  variant="ghost"
  size="icon-sm"
  className={cn(open && "[&_svg]:text-information")}
>
  <Icon name="ArrowUpAndDownIcon" className="size-4.5" />
</Button>
```

```tsx
// Wrong: class on the Icon gets overridden by parent's descendant selector
<Button variant="ghost" size="icon-sm">
  <Icon
    name="ArrowUpAndDownIcon"
    className={cn("size-4.5", open && "text-information")}
  />
</Button>
```

```tsx
// Sloppy: !important works but fights the specificity system
<Icon className={cn(open && "!text-information")} />
```

## Why `twMerge` Handles This

`tailwind-merge` recognizes `[&_svg]:text-icon` and `[&_svg]:text-information` as conflicting classes (same modifier prefix, same CSS property). When both appear, it keeps the last one — which is the className prop since `cn(buttonVariants({ variant, size, className }))` puts user classes after variant classes.

## Prevention

When overriding icon colors inside Buttons:
1. Check the Button variant for `[&_svg]:text-*` rules
2. Apply color overrides on the **Button** using `[&_svg]:text-*`, not on the Icon directly
3. Never use `!important` (`!` prefix) to fight specificity — match specificity instead

## Affected Components

- `article-sort-dropdown.tsx` — sort icon
- `article-search-input.tsx` — search icon
- `article-toolbar.tsx` — delete icon

## References

- Button variants: `packages/ui/src/primitives/button.tsx` (line 43, ghost variant)
- Icon component: `packages/ui/src/components/icon.tsx`
- `--color-icon`: `packages/ui/src/styles/globals.css` (line 140)
