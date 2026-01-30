---
paths:
  - "**/globals.css"
  - "**/tailwind.config.*"
  - "**/*.css"
---

# Tailwind CSS v4 Rules

## Version

This monorepo uses **Tailwind CSS v4** with CSS-first configuration (no `tailwind.config.js`).

## Scanning Workspace Packages

When apps use shared UI packages (`@feel-good/ui`), add `@source` directive to scan for utility classes:

```css
@import "tailwindcss";

@source "../node_modules/@feel-good/ui";
```

**Why node_modules path?**
- pnpm symlinks `node_modules/@feel-good/ui` → `packages/ui`
- Matches import resolution
- Officially recommended by Tailwind docs

**Alternative (direct path):**
```css
@source "../../../packages/ui/src";
```

## Theme Configuration

Use `@theme inline` for custom design tokens:

```css
@theme inline {
  --color-primary: var(--primary);
  --color-background: var(--background);
}
```

Define CSS variables in `:root` and `.dark`:

```css
:root {
  --primary: #ff0000;
  --background: var(--gray-1);
}

.dark {
  --primary: #ff0000;
  --background: var(--gray-1);
}
```

## Custom Variants

Use `@custom-variant` for custom variant definitions:

```css
@custom-variant dark (&:is(.dark *));
```

## Common Issues

### Classes not generating

If utility classes exist in HTML but not in CSS:
1. Check `@source` includes the package containing the class
2. Restart dev server after modifying `@source`
3. Verify with: `curl localhost:3001/_next/static/chunks/*.css | grep "class-name"`

### Radix UI Colors

Import Radix color scales for consistent theming:

```css
@import "@radix-ui/colors/gray.css";
@import "@radix-ui/colors/gray-dark.css";
```

## File Structure

```
apps/[app]/styles/
├── globals.css    # Main CSS with @import, @source, @theme
└── fonts.css      # Font-face declarations
```

## References

- Full docs: `docs/solutions/tailwind/monorepo-source-configuration.md`
- [Tailwind v4 Docs](https://tailwindcss.com/docs/detecting-classes-in-source-files)
