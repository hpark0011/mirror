# Design System Usage Guide

Practical guide for using design tokens in components.

## Token Hierarchy

The design system uses a three-layer architecture:

```
Primitive Tokens (Base Values)
    ↓
Semantic Tokens (Context-Specific)
    ↓
Component Tokens (Component-Specific)
```

### Layer 1: Primitive Tokens

**Location**: `styles/primitives.css`

**Purpose**: Base color values, spacing, typography scales.

**Usage**: **Only in CSS files** to build semantic tokens. Never use directly in components.

**Examples**:

- `--color-dq-gray-500`
- `--spacing-4`
- `--font-size-base`

### Layer 2: Semantic Tokens

**Location**: `styles/background-colors.css`, `styles/text-colors.css`, `styles/icon-colors.css`

**Purpose**: Context-specific tokens that adapt to theme (light/dark mode).

**Usage**: **Primary choice** for component styling.

**Examples**:

- `--color-text-primary` (text)
- `--color-base` (background)
- `--color-icon-medium` (icons)

### Layer 3: Component Tokens

**Location**: `styles/components.css`, `styles/globals.css`

**Purpose**: Specific to UI components (cards, dialogs, buttons).

**Usage**: When styling specific component types.

**Examples**:

- `--card` (card background)
- `--dialog` (dialog background)
- `--border` (border color)

## Decision Tree

Use this decision tree to select the right token:

```
Is it styling a specific component type?
├─ Yes → Use component token (bg-card, bg-dialog)
└─ No → Continue

Is it general page/container background?
├─ Yes → Use bg-base or bg-background
└─ No → Continue

Is it text content?
├─ Yes → Use text semantic token
│   ├─ Heading/strong → text-text-strong
│   ├─ Body → text-text-primary
│   ├─ Secondary → text-text-secondary
│   ├─ Muted → text-text-muted
│   └─ Status → text-text-success/error/warning/info
└─ No → Continue

Is it an icon?
├─ Yes → Use icon semantic token
│   ├─ Subtle → text-icon-extra-light
│   ├─ Default → text-icon-light or text-icon-medium
│   └─ Prominent → text-icon-dark
└─ No → Continue

Is it a general background?
├─ Yes → Use background semantic token
│   ├─ Base → bg-base
│   ├─ Light → bg-light
│   ├─ Medium → bg-medium
│   └─ Dark → bg-dark
└─ No → Use component token or create new semantic token
```

## Common Patterns

### Buttons

```tsx
// Primary button
<button className="bg-medium-inverse text-light shadow-button-primary">
  Click me
</button>

// Outline button
<button className="border border-input bg-transparent hover:bg-accent">
  Click me
</button>

// Ghost button
<button className="hover:bg-hover text-text-secondary">
  Click me
</button>
```

### Cards

```tsx
// Standard card
<Card className="bg-card border-card-border">
  <CardHeader>
    <h3 className="text-text-primary">Title</h3>
  </CardHeader>
  <CardContent className="text-text-secondary">
    Content
  </CardContent>
</Card>

// Dialog/Modal
<DialogContent className="bg-dialog">
  ...
</DialogContent>
```

### Text Hierarchy

```tsx
// Heading
<h1 className="text-text-strong text-2xl font-semibold">
  Main Heading
</h1>

// Body text
<p className="text-text-primary">
  Body content goes here.
</p>

// Secondary text
<span className="text-text-secondary">
  Additional information
</span>

// Muted text
<span className="text-text-muted text-sm">
  Helper text
</span>
```

### Icons

```tsx
// Default icon
<Icon name="CheckIcon" className="text-icon-medium" />

// Subtle icon
<Icon name="InfoIcon" className="text-icon-light" />

// Prominent icon
<Icon name="AlertIcon" className="text-icon-dark" />

// Status icon
<Icon name="CheckCircleIcon" className="text-text-success" />
```

### Status Indicators

```tsx
// Success
<span className="text-text-success">Success message</span>

// Error
<span className="text-text-error">Error message</span>

// Warning
<span className="text-text-warning">Warning message</span>

// Info
<span className="text-text-info">Info message</span>
```

## DO's and DON'Ts

### ✅ DO

**Use semantic tokens**:

```tsx
<div className='bg-base text-text-primary'>
  <Icon className='text-icon-medium' />
</div>
```

**Use Tailwind classes** that map to tokens:

```tsx
<div className='p-4 gap-2 rounded-lg shadow-md'>Content</div>
```

**Use component tokens** for specific components:

```tsx
<Card className='bg-card border-card-border'>...</Card>
```

**Let dark mode work automatically**:

```tsx
// No manual dark: classes needed for semantic tokens
<div className='bg-base text-text-primary'>
  {/* Automatically adapts to dark mode */}
</div>
```

### ❌ DON'T

**Don't use primitive tokens directly**:

```tsx
// ❌ Bad
<div className="bg-[var(--color-dq-gray-100)]">...</div>

// ✅ Good
<div className="bg-light">...</div>
```

**Don't use hardcoded colors**:

```tsx
// ❌ Bad
<div className="bg-[#f1f1f2]">...</div>
<div className="text-blue-500">...</div>

// ✅ Good
<div className="bg-dialog">...</div>
<div className="text-[var(--color-text-info)]">...</div>
```

**Don't use standard Tailwind color classes**:

```tsx
// ❌ Bad
<div className="bg-red-500 text-blue-500">...</div>

// ✅ Good
<div className="bg-[var(--color-dq-red-500)] text-[var(--color-text-info)]">...</div>
```

**Don't use arbitrary spacing/typography**:

```tsx
// ❌ Bad
<div className="p-[12px] text-[18px]">...</div>

// ✅ Good
<div className="p-3 text-lg">...</div>
```

**Don't manually handle dark mode** for semantic tokens:

```tsx
// ❌ Bad
<div className="bg-white dark:bg-black">...</div>

// ✅ Good
<div className="bg-base">...</div>
```

## Migration Guide

### Step 1: Identify Hardcoded Values

Look for:

- Hex colors: `#f1f1f2`, `#0F0F0F`
- RGB/RGBA: `rgba(255, 255, 255, 0.9)`
- Standard Tailwind: `bg-red-500`, `text-blue-500`
- Arbitrary values: `bg-[#...]`, `text-[rgba(...)]`

### Step 2: Find Equivalent Token

Use the decision tree or token reference to find the right token.

### Step 3: Replace

```tsx
// Before
<div className="bg-[#f1f1f2] dark:bg-[#0F0F0F]">
  Content
</div>

// After
<div className="bg-dialog">
  Content
</div>
```

### Step 4: Test

Verify the change works in both light and dark modes.

## Examples

### Example 1: Card Component

**Before**:

```tsx
<div className='bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 rounded-lg'>
  <h3 className='text-gray-900 dark:text-gray-100'>Title</h3>
  <p className='text-gray-600 dark:text-gray-400'>Content</p>
</div>
```

**After**:

```tsx
<Card className='bg-card border-card-border p-4 rounded-lg'>
  <h3 className='text-text-primary'>Title</h3>
  <p className='text-text-secondary'>Content</p>
</Card>
```

### Example 2: Button with Status

**Before**:

```tsx
<button className='bg-blue-500 hover:bg-blue-600 text-white'>Submit</button>
```

**After**:

```tsx
<button className='bg-[var(--color-dq-blue-500)] hover:bg-[var(--color-dq-blue-600)] text-primary-foreground'>
  Submit
</button>
```

### Example 3: Icon with Text

**Before**:

```tsx
<div className='flex items-center gap-2'>
  <Icon className='text-gray-500' />
  <span className='text-gray-700'>Label</span>
</div>
```

**After**:

```tsx
<div className='flex items-center gap-2'>
  <Icon className='text-icon-medium' />
  <span className='text-text-secondary'>Label</span>
</div>
```

## Best Practices

1. **Start with semantic tokens** - They handle theme automatically
2. **Use component tokens** when available - They're optimized for specific use cases
3. **Avoid primitive tokens** in components - They don't adapt to theme
4. **Prefer Tailwind classes** - Better IDE support and consistency
5. **Document exceptions** - If you must use a hardcoded value, document why

## Troubleshooting

### Token not working?

1. Check if token is defined in CSS file
2. Verify token is bridged to Tailwind in `globals.css`
3. Ensure you're using the correct Tailwind class format
4. Check browser DevTools for CSS variable resolution

### Dark mode not working?

1. Verify `.dark` class is applied to parent element
2. Check if token has dark mode variant defined
3. Ensure you're using semantic token, not primitive token

### Need a new token?

1. Add primitive token if needed
2. Create semantic token in appropriate CSS file
3. Add dark mode variant
4. Bridge to Tailwind in `globals.css`
5. Document in token reference
