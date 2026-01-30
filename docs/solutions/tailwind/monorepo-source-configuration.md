# Tailwind CSS v4: Monorepo Source Configuration

## Problem

In a monorepo with shared UI packages, Tailwind CSS v4 needs to know where to scan for utility classes. By default, Tailwind only scans files in the current project directory and ignores `node_modules`. This means utility classes used in workspace packages (like `@feel-good/ui`) won't be generated.

**Symptom**: Classes like `bg-primary` exist in HTML but have no corresponding CSS rules.

## Solution

Use the `@source` directive in your CSS file to tell Tailwind where to scan for classes.

### Recommended Approach: node_modules Path

```css
@import "tailwindcss";

@source "../node_modules/@feel-good/ui";
```

This is the **officially recommended approach** from Tailwind CSS documentation.

**Why this works:**
- pnpm creates symlinks in `node_modules/@feel-good/ui` → `packages/ui`
- Matches how your code imports the package
- Works regardless of physical package location

### Alternative: Direct Workspace Path

```css
@import "tailwindcss";

@source "../../../packages/ui/src";
```

**Pros**: No dependency on node_modules structure
**Cons**: Path breaks if package location changes

## Configuration Options

### Option 1: Add to Existing Detection (Default)

```css
@import "tailwindcss";
@source "../node_modules/@feel-good/ui";
```

Tailwind scans the current directory automatically, plus your explicit sources.

### Option 2: Full Control with source(none)

```css
@import "tailwindcss" source(none);

@source "./";
@source "../node_modules/@feel-good/ui";
@source "../node_modules/@feel-good/icons";
```

Disables automatic detection. You must explicitly list all paths to scan.

### Option 3: Change Base Path

```css
@import "tailwindcss" source("../../..");
```

Changes the base directory for automatic scanning. Useful when builds run from monorepo root.

## Current Configuration

### apps/mirror/styles/globals.css

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "./fonts.css";

@source "../node_modules/@feel-good/ui";

/* ... rest of configuration */
```

### apps/greyboard/styles/globals.css

Should include the same `@source` directive if using shared UI components.

## Troubleshooting

### Classes not being generated

1. **Check the path**: Ensure `@source` path is correct relative to the CSS file
2. **Restart dev server**: Changes to `@source` may require a restart
3. **Verify symlink**: Run `ls -la node_modules/@feel-good/ui` to confirm symlink exists
4. **Check CSS output**: Search generated CSS for the missing class

### Debugging

```bash
# Check if symlink exists
ls -la apps/mirror/node_modules/@feel-good/ui

# Search generated CSS for a class
curl -s "http://localhost:3001/_next/static/chunks/*.css" | grep "bg-primary"
```

## References

- [Tailwind CSS v4 - Detecting Classes in Source Files](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- [Tailwind CSS v4 - Functions and Directives](https://tailwindcss.com/docs/functions-and-directives)
- [shadcn/ui Monorepo Documentation](https://ui.shadcn.com/docs/monorepo)

## Related

- `@theme inline` block for defining custom colors
- `@custom-variant` for custom variant definitions
- Provider separation patterns: `docs/solutions/architecture-patterns/provider-separation-of-concerns.md`
