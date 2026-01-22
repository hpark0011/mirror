# Design Tokens Reference

Complete reference for all design tokens beyond colors.

## Spacing Tokens

Defined in `styles/primitives.css`. All spacing uses 4px base unit.

| Token          | Value  | Tailwind Class | Usage                |
| -------------- | ------ | -------------- | -------------------- |
| `--spacing-0`  | `0`    | `p-0`, `m-0`   | No spacing           |
| `--spacing-1`  | `4px`  | `p-1`, `m-1`   | Minimal spacing      |
| `--spacing-2`  | `8px`  | `p-2`, `m-2`   | Small spacing        |
| `--spacing-3`  | `12px` | `p-3`, `m-3`   | Medium-small spacing |
| `--spacing-4`  | `16px` | `p-4`, `m-4`   | Medium spacing       |
| `--spacing-5`  | `20px` | `p-5`, `m-5`   | Medium-large spacing |
| `--spacing-6`  | `24px` | `p-6`, `m-6`   | Large spacing        |
| `--spacing-8`  | `32px` | `p-8`, `m-8`   | Extra large spacing  |
| `--spacing-10` | `40px` | `p-10`, `m-10` | 2.5x spacing         |
| `--spacing-12` | `48px` | `p-12`, `m-12` | 3x spacing           |
| `--spacing-16` | `64px` | `p-16`, `m-16` | 4x spacing           |
| `--spacing-20` | `80px` | `p-20`, `m-20` | 5x spacing           |
| `--spacing-24` | `96px` | `p-24`, `m-24` | 6x spacing           |

**Usage**: Prefer Tailwind spacing classes (`p-4`, `gap-2`) over arbitrary values.

## Typography Tokens

### Font Sizes

| Token              | Value  | Usage            |
| ------------------ | ------ | ---------------- |
| `--font-size-xs`   | `11px` | Extra small text |
| `--font-size-sm`   | `14px` | Small text       |
| `--font-size-base` | `17px` | Base body text   |
| `--font-size-lg`   | `20px` | Large text       |
| `--font-size-xl`   | `24px` | Extra large text |
| `--font-size-2xl`  | `28px` | 2x large text    |
| `--font-size-3xl`  | `34px` | 3x large text    |
| `--font-size-4xl`  | `40px` | 4x large text    |
| `--font-size-5xl`  | `48px` | 5x large text    |

**Usage**: Use Tailwind text size classes (`text-sm`, `text-base`, `text-lg`) which map to these tokens.

### Font Weights

| Token                    | Value | Tailwind Class  | Usage           |
| ------------------------ | ----- | --------------- | --------------- |
| `--font-weight-regular`  | `400` | `font-normal`   | Regular text    |
| `--font-weight-medium`   | `500` | `font-medium`   | Medium emphasis |
| `--font-weight-semibold` | `600` | `font-semibold` | Semi-bold       |
| `--font-weight-bold`     | `700` | `font-bold`     | Bold text       |

### Line Heights

| Token                   | Value  | Usage                        |
| ----------------------- | ------ | ---------------------------- |
| `--line-height-tight`   | `1.2`  | Tight line height (headings) |
| `--line-height-snug`    | `1.33` | Snug line height             |
| `--line-height-normal`  | `1.41` | Normal line height (body)    |
| `--line-height-relaxed` | `1.5`  | Relaxed line height          |

### Font Families

| Token               | Usage                     |
| ------------------- | ------------------------- |
| `--font-bdogrotesk` | Brand font                |
| `--font-pretendard` | UI font                   |
| `--font-lora`       | Serif font                |
| `--font-family`     | Default system font stack |

## Border Tokens

### Border Radius

| Token           | Value    | Tailwind Class | Usage              |
| --------------- | -------- | -------------- | ------------------ |
| `--radius-none` | `0`      | `rounded-none` | No radius          |
| `--radius-sm`   | `4px`    | `rounded-sm`   | Small radius       |
| `--radius-md`   | `8px`    | `rounded-md`   | Medium radius      |
| `--radius-lg`   | `12px`   | `rounded-lg`   | Large radius       |
| `--radius-xl`   | `16px`   | `rounded-xl`   | Extra large radius |
| `--radius-2xl`  | `20px`   | `rounded-2xl`  | 2x large radius    |
| `--radius-full` | `9999px` | `rounded-full` | Full circle        |

**shadcn/ui radius tokens** (calculated from base `--radius`):

- `--radius-sm`: `calc(var(--radius) - 4px)`
- `--radius-md`: `calc(var(--radius) - 2px)`
- `--radius-lg`: `var(--radius)` (0.625rem)
- `--radius-xl`: `calc(var(--radius) + 4px)`

### Border Widths

| Token              | Value | Usage              |
| ------------------ | ----- | ------------------ |
| `--border-width-0` | `0px` | No border          |
| `--border-width-1` | `1px` | Thin border        |
| `--border-width-2` | `2px` | Medium border      |
| `--border-width-4` | `4px` | Thick border       |
| `--border-width-8` | `8px` | Extra thick border |

**Usage**: Use Tailwind border classes (`border`, `border-2`) which map to these tokens.

## Shadow Tokens

### Base Shadows

Defined in `styles/primitives.css`:

| Token         | Value                                                                     | Usage         |
| ------------- | ------------------------------------------------------------------------- | ------------- |
| `--shadow-sm` | `0 1px 2px 0 rgba(0, 0, 0, 0.05)`                                         | Small shadow  |
| `--shadow-md` | `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)`   | Medium shadow |
| `--shadow-lg` | `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)` | Large shadow  |

### Component Shadows

Defined in `styles/shadows.css`. These shadows adapt to dark mode.

**Button Shadows**:

- `--shadow-button-primary`: Primary button shadow
- `--shadow-button-primary-hover`: Primary button hover shadow
- `--shadow-button-outline-hover`: Outline button hover shadow
- `--shadow-button-submit`: Submit button shadow
- `--shadow-button-submit-hover`: Submit button hover shadow

**Usage**: Apply via Tailwind classes or CSS variables.

## Icon Sizes

| Token            | Value  | Usage             |
| ---------------- | ------ | ----------------- |
| `--icon-size-xs` | `12px` | Extra small icons |
| `--icon-size-sm` | `16px` | Small icons       |
| `--icon-size-md` | `20px` | Medium icons      |
| `--icon-size-lg` | `24px` | Large icons       |
| `--icon-size-xl` | `32px` | Extra large icons |

**Usage**: Use Tailwind size utilities (`size-4`, `size-5`) or icon component props.

## Usage Guidelines

### ✅ DO: Use Tailwind Classes

```tsx
// Spacing
<div className="p-4 gap-2">...</div>

// Typography
<h1 className="text-2xl font-semibold">...</h1>

// Borders
<div className="rounded-lg border">...</div>

// Shadows
<div className="shadow-md">...</div>
```

### ❌ DON'T: Use Arbitrary Values

```tsx
// ❌ Bad
<div className="p-[12px]">...</div>
<div className="text-[18px]">...</div>
<div className="rounded-[8px]">...</div>

// ✅ Good
<div className="p-3">...</div>
<div className="text-lg">...</div>
<div className="rounded-md">...</div>
```

### When to Use CSS Variables Directly

Use CSS variables directly only when:

1. Tailwind doesn't have a corresponding class
2. You need dynamic values in JavaScript
3. You're defining new tokens in CSS files

```tsx
// ✅ Valid: Dynamic value
<div style={{ padding: `var(--spacing-${size})` }}>...</div>

// ✅ Valid: Custom property in CSS
.custom-class {
  box-shadow: var(--shadow-button-primary);
}
```

## Token Organization

Tokens are organized by category in separate CSS files:

- `primitives.css`: Base tokens (colors, spacing, typography, borders)
- `background-colors.css`: Background semantic tokens
- `text-colors.css`: Text semantic tokens
- `icon-colors.css`: Icon semantic tokens
- `shadows.css`: Component shadow tokens
- `components.css`: Component-specific tokens
- `globals.css`: shadcn/ui tokens and Tailwind bridge

## Adding New Tokens

1. **Add to appropriate CSS file** based on category
2. **Follow naming convention**: `--{category}-{name}-{variant?}`
3. **Add dark mode variant** if applicable
4. **Bridge to Tailwind** in `globals.css` `@theme inline` block
5. **Document** in this file
