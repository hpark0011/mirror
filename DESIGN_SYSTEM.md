# Design System Documentation

## Overview

This design system is built on **Tailwind CSS v4** with a sophisticated CSS custom properties (variables) architecture that enables consistent theming, dark mode support, and component modularity. The system combines modern CSS practices with React component patterns to create a maintainable and scalable design foundation.

## CSS Architecture

### Core Technologies

- **Tailwind CSS v4**: Latest version with native CSS variables support
- **PostCSS**: Build-time CSS processing via `@tailwindcss/postcss`
- **CSS Custom Properties**: Dynamic theming and runtime value changes
- **OKLCH Color Space**: Perceptually uniform color system for better accessibility

### File Structure

```
styles/
├── globals.css          # Main entry point, imports and theme config
├── primitives.css       # Base design tokens (colors, spacing, typography)
├── text-colors.css      # Semantic text color mappings
├── icon-colors.css      # Semantic icon color mappings
├── background-colors.css # Semantic background color mappings
├── border-colors.css    # Border color system (included via globals)
├── shadows.css          # Shadow tokens (included via globals)
└── components.css       # Component-specific variables
```

### Import Hierarchy

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "./primitives.css";
@import "./text-colors.css";
@import "./icon-colors.css";
@import "./background-colors.css";
@import "./shadows.css";
@import "./components.css";
```

## Variable Organization

### 1. Primitive Layer (`primitives.css`)

Base-level design tokens that form the foundation of the system:

#### Color Primitives
- **DQ Gray Scale**: 16 shades from `--color-dq-gray-25` to `--color-dq-gray-975`
- **Status Colors**: Red, Yellow, Blue, Green scales (50-950)
- **Special Colors**: Black, White, Neon Yellow

#### Spacing System
```css
--spacing-0: 0;
--spacing-1: 4px;
--spacing-2: 8px;
--spacing-3: 12px;
--spacing-4: 16px;
--spacing-5: 20px;
--spacing-6: 24px;
--spacing-8: 32px;
--spacing-10: 40px;
--spacing-12: 48px;
--spacing-16: 64px;
--spacing-20: 80px;
--spacing-24: 96px;
```

#### Typography
```css
/* Font Sizes */
--font-size-xs: 11px;
--font-size-sm: 14px;
--font-size-base: 17px;
--font-size-lg: 20px;
--font-size-xl: 24px;
--font-size-2xl: 28px;
--font-size-3xl: 34px;
--font-size-4xl: 40px;
--font-size-5xl: 48px;

/* Font Weights */
--font-weight-regular: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

#### Other Tokens
- **Border Radius**: `--radius-sm` to `--radius-full`
- **Icon Sizes**: `--icon-size-xs` to `--icon-size-xl`
- **Shadows**: `--shadow-sm`, `--shadow-md`, `--shadow-lg`
- **Border Widths**: 0px, 1px, 2px, 4px, 8px

### 2. Semantic Layer

Semantic tokens map primitive values to meaningful use cases:

#### Text Colors (`text-colors.css`)
```css
/* Light Mode */
--color-text-strong: var(--color-dq-gray-1000);
--color-text-primary: var(--color-dq-gray-900);
--color-text-secondary: var(--color-dq-gray-700);
--color-text-tertiary: var(--color-dq-gray-600);
--color-text-muted: var(--color-dq-gray-500);

/* Inverse variants for contrast */
--color-text-primary-inverse: var(--color-dq-gray-25);
--color-text-secondary-inverse: var(--color-dq-gray-200);
```

#### Background Colors (`background-colors.css`)
```css
/* Progressive darkness scale */
--color-base: var(--color-white);
--color-extra-light: var(--color-dq-gray-100);
--color-light: var(--color-dq-gray-200);
--color-medium: var(--color-dq-gray-300);
--color-dark: var(--color-dq-gray-400);
--color-extra-dark: var(--color-dq-gray-500);

/* Inverse variants */
--color-extra-light-inverse: var(--color-dq-gray-975);
--color-light-inverse: var(--color-dq-gray-950);
```

### 3. Component Layer

Component-specific variables for reusable UI patterns:

```css
--card: oklch(0.97 0 0 / 100%);
--card-border: oklch(1 0 0 / 70%);
```

### 4. Tailwind Integration

Custom properties are exposed to Tailwind via `@theme inline`:

```css
@theme inline {
  /* Maps CSS variables to Tailwind utilities */
  --color-base: var(--color-base);
  --color-text-primary: var(--color-text-primary);
  /* ... all semantic tokens */
  
  /* shadcn/ui compatibility */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... all shadcn tokens */
}
```

## Theme Implementation

### Dark Mode Architecture

Dark mode uses a `.dark` class applied to the root element, which overrides CSS variables:

```css
/* Light Mode (default) */
:root {
  --background: #eee;
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  /* ... */
}

/* Dark Mode */
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.922 0 0);
  /* ... */
}
```

### Automatic Inversions

The system uses "inverse" variants that automatically flip in dark mode:

```css
/* Light Mode */
--color-medium-inverse: var(--color-dq-gray-900);

/* Dark Mode */
--color-medium-inverse: var(--color-dq-gray-100);
```

This allows components to use semantic tokens that adapt automatically.

### Theme Provider

Uses `next-themes` for theme management:

```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
  disableTransitionOnChange
>
  {children}
</ThemeProvider>
```

## Component Patterns

### Class Variance Authority (CVA)

Components use CVA for type-safe variant management:

```tsx
const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "variant-specific-classes",
        primary: "bg-medium-inverse dark:bg-dark-inverse",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-[13px]",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);
```

### Class Merging with `cn()`

The `cn()` utility combines `clsx` and `tailwind-merge`:

```tsx
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Usage:
```tsx
<Button className={cn("custom-class", conditionalClass && "active")} />
```

### Component Structure

Components follow these patterns:

1. **Data Attributes**: Use `data-slot` for component identification
2. **Radix UI Integration**: Leverage headless UI primitives
3. **Slot Pattern**: Support polymorphic components via `asChild`

```tsx
function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : "button";
  
  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

## Color System

### OKLCH Color Space

The system uses OKLCH for perceptually uniform colors:

```css
/* Format: oklch(lightness chroma hue / alpha) */
--primary: oklch(0.205 0 0);        /* Neutral gray */
--destructive: oklch(0.577 0.245 27.325); /* Red with hue */
```

Benefits:
- Predictable lightness adjustments
- Better color interpolation
- Consistent perceptual brightness across hues

### Semantic Color Tokens

#### Status Colors
- `--color-text-success`: Green for positive states
- `--color-text-warning`: Yellow for caution
- `--color-text-error`: Red for errors
- `--color-text-info`: Blue for information

#### Highlight System
- Light: `rgba(234, 255, 170, 0.9)` - High opacity yellow
- Dark: `rgba(234, 255, 170, 0.2)` - Low opacity for dark backgrounds

## Best Practices

### 1. Variable Naming Conventions

Follow the pattern: `--[property]-[context]-[modifier]-[state]`

Examples:
- `--color-text-primary`
- `--color-background-inverse`
- `--shadow-button-primary-hover`

### 2. Component Development

1. **Use semantic tokens** over primitive values
2. **Leverage CVA** for variant management
3. **Apply `cn()`** for dynamic class merging
4. **Include `data-slot`** attributes for testing/debugging
5. **Support `asChild`** for component flexibility

### 3. Theme-Aware Development

1. **Test in both themes**: Always verify light and dark modes
2. **Use inverse variants**: For automatic theme adaptation
3. **Avoid hardcoded colors**: Always use CSS variables
4. **Consider contrast**: Ensure WCAG compliance

### 4. Performance Optimization

1. **Use Tailwind utilities** where possible
2. **Minimize custom CSS** in components
3. **Leverage CSS variables** for runtime theming
4. **Keep specificity low** for easier overrides

### 5. File Organization

1. **Separate concerns**: One CSS file per token type
2. **Import order matters**: Primitives → Semantic → Components
3. **Document variables**: Add comments for non-obvious values
4. **Group related tokens**: Keep similar variables together

## Responsive Design

### Tailwind Breakpoints

The system uses Tailwind's default breakpoints with container queries enabled:

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Container Queries

Enabled in Tailwind for component-level responsive design:

```css
@container (min-width: 768px) {
  /* Styles based on container size */
}
```

## Integration with shadcn/ui

The system is fully compatible with shadcn/ui components:

1. **New York style** preset configured
2. **Radix UI** primitives as base
3. **Custom theme tokens** mapped to shadcn variables
4. **Component library** in `/components/ui`

### Key Mappings

```css
--color-background: var(--background);
--color-foreground: var(--foreground);
--color-primary: var(--primary);
--color-border: var(--border);
--color-ring: var(--ring);
/* Chart colors, sidebar tokens, etc. */
```

## Maintenance Guidelines

1. **Add new primitives** to `primitives.css` first
2. **Create semantic mappings** in appropriate files
3. **Update both light and dark** theme definitions
4. **Document new patterns** in this file
5. **Test across browsers** for variable support
6. **Verify accessibility** with contrast checkers

## Future Considerations

- **CSS Layers**: Consider `@layer` for better cascade control
- **Custom Properties API**: Type checking for CSS variables
- **Design Tokens Format**: Potential migration to W3C format
- **Component Documentation**: Storybook or similar for visual docs