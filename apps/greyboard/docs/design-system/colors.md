# Color Tokens Reference

Complete reference for all color tokens in the design system.

## Token Hierarchy

The design system uses a three-layer token architecture:

1. **Primitive Tokens** - Base color values (defined in `styles/primitives.css`)
2. **Semantic Tokens** - Context-specific colors (background, text, icon)
3. **Component Tokens** - Component-specific colors (card, dialog, button)

## Primitive Colors

### Gray Scale

The gray scale provides 19 shades from lightest to darkest:

| Token                 | Value     | Usage                   |
| --------------------- | --------- | ----------------------- |
| `--color-dq-gray-25`  | `#f6f6fb` | Lightest background     |
| `--color-dq-gray-50`  | `#f2f2f5` | Very light background   |
| `--color-dq-gray-75`  | `#eeeeee` | Light background        |
| `--color-dq-gray-100` | `#e5e5e7` | Light background        |
| `--color-dq-gray-150` | `#dbdbdf` | Light-medium background |
| `--color-dq-gray-200` | `#d1d1d6` | Light-medium background |
| `--color-dq-gray-300` | `#c7c7cc` | Medium-light background |
| `--color-dq-gray-400` | `#aeaeb2` | Medium background       |
| `--color-dq-gray-500` | `#8e8e8e` | Medium text/icon        |
| `--color-dq-gray-600` | `#636367` | Medium-dark text/icon   |
| `--color-dq-gray-700` | `#48484c` | Dark text               |
| `--color-dq-gray-800` | `#39393a` | Darker text             |
| `--color-dq-gray-850` | `#323232` | Very dark background    |
| `--color-dq-gray-900` | `#2d2d2d` | Darkest text            |
| `--color-dq-gray-925` | `#262626` | Very dark background    |
| `--color-dq-gray-950` | `#1e1e1e` | Very dark background    |
| `--color-dq-gray-975` | `#121212` | Darkest background      |

**Usage**: Primitive tokens should **only** be used in CSS files to build semantic tokens. Never use them directly in components.

### Color Scales

Each color (red, yellow, blue, green) has a scale from 50 (lightest) to 950 (darkest):

- `--color-dq-red-{50-950}`
- `--color-dq-yellow-{50-950}`
- `--color-dq-blue-{50-950}`
- `--color-dq-green-{50-950}`

**Common usage**:

- `-500`: Primary brand color
- `-100`: Light backgrounds
- `-600`: Darker variants

### Special Colors

- `--color-black`: `#000000`
- `--color-white`: `#ffffff`
- `--color-neon-yellow`: `rgb(225, 255, 156)`

## Semantic Colors

### Background Colors

Defined in `styles/background-colors.css`. These tokens adapt automatically for light/dark mode.

| Token                 | Light Mode            | Dark Mode             | Usage                  |
| --------------------- | --------------------- | --------------------- | ---------------------- |
| `--color-base`        | `--color-white`       | `--color-black`       | Base page background   |
| `--color-extra-light` | `--color-dq-gray-100` | `--color-dq-gray-975` | Subtle backgrounds     |
| `--color-light`       | `--color-dq-gray-200` | `--color-dq-gray-950` | Light backgrounds      |
| `--color-medium`      | `--color-dq-gray-300` | `--color-dq-gray-900` | Medium backgrounds     |
| `--color-dark`        | `--color-dq-gray-400` | `--color-dq-gray-850` | Dark backgrounds       |
| `--color-extra-dark`  | `--color-dq-gray-500` | `--color-dq-gray-800` | Extra dark backgrounds |
| `--color-highlight`   | `--color-neon-yellow` | `--color-neon-yellow` | Highlight color        |

**Inverse variants** (`-inverse`) are available for use on opposite backgrounds.

**Usage in Tailwind**: `bg-base`, `bg-light`, `bg-medium`, etc.

### Text Colors

Defined in `styles/text-colors.css`. Semantic text colors that adapt to theme.

| Token                    | Light Mode            | Dark Mode             | Usage                     |
| ------------------------ | --------------------- | --------------------- | ------------------------- |
| `--color-text-strong`    | `--color-dq-gray-975` | `--color-dq-gray-25`  | Strongest text (headings) |
| `--color-text-primary`   | `--color-dq-gray-900` | `--color-dq-gray-100` | Primary text              |
| `--color-text-secondary` | `--color-dq-gray-700` | `--color-dq-gray-300` | Secondary text            |
| `--color-text-tertiary`  | `--color-dq-gray-600` | `--color-dq-gray-400` | Tertiary text             |
| `--color-text-muted`     | `--color-dq-gray-500` | `--color-dq-gray-600` | Muted text                |

**Status colors**:

- `--color-text-success`: Green for success states
- `--color-text-error`: Red for error states
- `--color-text-warning`: Yellow for warning states
- `--color-text-info`: Blue for informational states

**Usage in Tailwind**: `text-text-primary`, `text-text-secondary`, `text-text-muted`, etc.

### Icon Colors

Defined in `styles/icon-colors.css`. Optimized for icon visibility.

| Token                      | Light Mode            | Dark Mode             | Usage        |
| -------------------------- | --------------------- | --------------------- | ------------ |
| `--color-icon-extra-light` | `--color-dq-gray-300` | `--color-dq-gray-800` | Subtle icons |
| `--color-icon-light`       | `--color-dq-gray-400` | `--color-dq-gray-700` | Light icons  |
| `--color-icon-medium`      | `--color-dq-gray-500` | `--color-dq-gray-600` | Medium icons |
| `--color-icon-dark`        | `--color-dq-gray-600` | `--color-dq-gray-500` | Dark icons   |

**Usage in Tailwind**: `text-icon-light`, `text-icon-medium`, `text-icon-dark`, etc.

## Component Colors

### shadcn/ui Colors

Defined in `styles/globals.css`. Uses oklch color space for better perceptual uniformity.

**Core semantic tokens**:

- `--background`: Page background
- `--foreground`: Primary text color
- `--primary`: Primary brand color
- `--secondary`: Secondary color
- `--muted`: Muted backgrounds
- `--accent`: Accent color
- `--destructive`: Error/destructive actions
- `--border`: Border color
- `--input`: Input field background
- `--ring`: Focus ring color

**Component-specific**:

- `--card`: Card background
- `--card-border`: Card border
- `--dialog`: Dialog/modal background
- `--popover`: Popover background
- `--sidebar-*`: Sidebar-specific colors

**Usage in Tailwind**: `bg-background`, `text-foreground`, `bg-card`, `bg-dialog`, etc.

## Dark Mode

All semantic tokens automatically adapt to dark mode via the `.dark` class selector. The system uses:

1. **Inverted grays**: Light mode grays become dark mode grays
2. **Consistent color scales**: Status colors (red, green, blue, yellow) remain consistent
3. **Automatic switching**: No manual dark mode handling needed in components

## Usage Examples

### ✅ DO: Use Semantic Tokens

```tsx
// Background
<div className="bg-base">...</div>
<div className="bg-card">...</div>

// Text
<span className="text-text-primary">Primary text</span>
<span className="text-text-muted">Muted text</span>

// Icons
<Icon className="text-icon-medium" />
```

### ❌ DON'T: Use Primitive Tokens Directly

```tsx
// ❌ Bad
<div className="bg-[var(--color-dq-gray-100)]">...</div>

// ✅ Good
<div className="bg-light">...</div>
```

### ❌ DON'T: Use Hardcoded Colors

```tsx
// ❌ Bad
<div className="bg-[#f1f1f2]">...</div>
<div className="text-blue-500">...</div>

// ✅ Good
<div className="bg-dialog">...</div>
<div className="text-[var(--color-text-info)]">...</div>
```

## Token Selection Decision Tree

1. **Is it a component background?**

   - Yes → Use component token (`bg-card`, `bg-dialog`)
   - No → Continue

2. **Is it general page background?**

   - Yes → Use `bg-base` or `bg-background`
   - No → Continue

3. **Is it text?**

   - Yes → Use text semantic token (`text-text-primary`, `text-text-muted`)
   - No → Continue

4. **Is it an icon?**

   - Yes → Use icon semantic token (`text-icon-light`, `text-icon-medium`)
   - No → Continue

5. **Is it a status indicator?**
   - Yes → Use status token (`text-text-success`, `text-text-error`)
   - No → Use background semantic token (`bg-light`, `bg-medium`)

## Adding New Colors

1. **Add primitive color** to `styles/primitives.css` if needed
2. **Create semantic token** in appropriate file (`background-colors.css`, `text-colors.css`, etc.)
3. **Add dark mode variant** in `.dark` selector
4. **Bridge to Tailwind** in `globals.css` `@theme inline` block
5. **Document** in this file
