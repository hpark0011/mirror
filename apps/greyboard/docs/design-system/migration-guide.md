# Migration Guide: Hardcoded Values to Design Tokens

Step-by-step guide for migrating hardcoded color and spacing values to design tokens.

## Overview

This guide helps you identify and replace hardcoded values with design tokens throughout the codebase.

## Common Violations

### 1. Hex Colors

**Pattern**: `#[0-9a-fA-F]{3,6}`

**Examples**:
- `bg-[#f1f1f2]`
- `text-[#0F0F0F]`
- `border-[#cccccc]`

**Fix**: Replace with semantic or component tokens

```tsx
// Before
<div className="bg-[#f1f1f2] dark:bg-[#0F0F0F]">...</div>

// After
<div className="bg-dialog">...</div>
```

### 2. RGB/RGBA Colors

**Pattern**: `rgba?\([^)]+\)`

**Examples**:
- `rgba(255, 255, 255, 0.9)`
- `rgb(225, 255, 156)`
- `shadow-[0_0_0_2px_rgba(0,0,0,0.15)]`

**Fix**: Extract to shadow token or use existing token

```tsx
// Before
<div className="shadow-[0_0_0_2px_rgba(0,0,0,0.15)]">...</div>

// After (if shadow token exists)
<div className="shadow-button-outline-hover">...</div>

// Or create new shadow token in shadows.css
```

### 3. Standard Tailwind Color Classes

**Pattern**: `bg-{color}-{number}`, `text-{color}-{number}`

**Examples**:
- `bg-red-500`
- `text-blue-500`
- `border-green-500`

**Fix**: Use CSS variable with design token

```tsx
// Before
<div className="bg-red-500">...</div>

// After
<div className="bg-[var(--color-dq-red-500)]">...</div>

// Or use semantic token if available
<div className="bg-[var(--color-text-error)]">...</div>
```

### 4. Arbitrary Spacing

**Pattern**: `(?:m|p)[tlrb]?-\[[0-9]+px\]`

**Examples**:
- `p-[12px]`
- `ml-[8px]`
- `gap-[16px]`

**Fix**: Use Tailwind spacing classes

```tsx
// Before
<div className="p-[12px] ml-[8px] gap-[16px]">...</div>

// After
<div className="p-3 ml-2 gap-4">...</div>
```

### 5. Arbitrary Typography

**Pattern**: `text-\[[0-9]+px\]`

**Examples**:
- `text-[18px]`
- `text-[13px]`

**Fix**: Use Tailwind text size classes

```tsx
// Before
<span className="text-[13px]">...</span>

// After
<span className="text-xs">...</span>
```

## Step-by-Step Migration Process

### Step 1: Identify Violations

Use grep or search to find violations:

```bash
# Find hex colors
grep -r "#[0-9a-fA-F]\{3,6\}" components/

# Find standard Tailwind colors
grep -r "bg-\(red\|blue\|green\|yellow\|orange\|purple\|pink\|gray\|neutral\)-\d\+" components/

# Find arbitrary spacing
grep -r "\(m\|p\)[tlrb]\?-\[[0-9]\+px\]" components/
```

### Step 2: Categorize by Severity

**Critical**: Broken references, missing dark mode variants
**High**: Hardcoded colors in frequently used components
**Medium**: Hardcoded spacing/typography
**Low**: One-off values in rarely used components

### Step 3: Find Equivalent Token

Use the decision tree from `usage-guide.md`:

1. Is it a component? → Use component token
2. Is it text? → Use text semantic token
3. Is it background? → Use background semantic token
4. Is it a status? → Use status token

### Step 4: Replace

Replace the hardcoded value with the token:

```tsx
// Before
<div className="bg-[#f1f1f2] dark:bg-[#0F0F0F] text-blue-500 p-[12px]">
  Content
</div>

// After
<div className="bg-dialog text-[var(--color-text-info)] p-3">
  Content
</div>
```

### Step 5: Test

1. Verify visual appearance matches
2. Test in both light and dark modes
3. Check responsive behavior
4. Verify accessibility (contrast ratios)

## Common Migration Patterns

### Dialog/Modal Backgrounds

**Before**:
```tsx
className="bg-[#f1f1f2] dark:bg-[#0F0F0F]"
```

**After**:
```tsx
className="bg-dialog"
```

### Project Color Tags

**Before**:
```tsx
{ color: "red", bgClass: "bg-red-500" }
```

**After**:
```tsx
{ color: "red", bgClass: "bg-[var(--color-dq-red-500)]" }
```

### Status Icons

**Before**:
```tsx
iconColor: "text-blue-500"
```

**After**:
```tsx
iconColor: "text-[var(--color-text-info)]"
```

### Card Backgrounds

**Before**:
```tsx
className="bg-white dark:bg-gray-900"
```

**After**:
```tsx
className="bg-card"
```

### Text Colors

**Before**:
```tsx
className="text-gray-700 dark:text-gray-300"
```

**After**:
```tsx
className="text-text-secondary"
```

## Files to Prioritize

1. **Config files** (`config/*.config.ts`) - High impact, used everywhere
2. **Shared components** (`components/ui/*`) - Used across app
3. **Feature components** (`features/*`) - Core functionality
4. **Page components** (`app/**/*.tsx`) - User-facing

## Creating New Tokens

If no equivalent token exists:

### 1. Add Primitive Token (if needed)

```css
/* styles/primitives.css */
:root {
  --color-dq-purple-500: #a855f7;
}
```

### 2. Create Semantic Token

```css
/* styles/background-colors.css */
:root {
  --color-project-purple: var(--color-dq-purple-500);
}

.dark {
  --color-project-purple: var(--color-dq-purple-600);
}
```

### 3. Bridge to Tailwind

```css
/* styles/globals.css */
@theme inline {
  --color-project-purple: var(--color-project-purple);
}
```

### 4. Use in Components

```tsx
<div className="bg-[var(--color-project-purple)]">...</div>
```

## Validation Checklist

After migration, verify:

- [ ] No hex colors remain (except in CSS files)
- [ ] No standard Tailwind color classes (`bg-red-500`)
- [ ] No arbitrary spacing (`p-[12px]`)
- [ ] Dark mode works automatically
- [ ] Visual appearance matches original
- [ ] Accessibility maintained (contrast ratios)
- [ ] Responsive behavior unchanged

## Tools & Scripts

### Find Violations

```bash
# Hex colors
grep -rn "#[0-9a-fA-F]\{3,6\}" --include="*.tsx" --include="*.ts" components/ app/

# Standard Tailwind colors
grep -rn "bg-\(red\|blue\|green\|yellow\|orange\|purple\|pink\|gray\|neutral\)-\d\+" --include="*.tsx" --include="*.ts" components/ app/

# Arbitrary spacing
grep -rn "\(m\|p\)[tlrb]\?-\[[0-9]\+px\]" --include="*.tsx" --include="*.ts" components/ app/
```

### Validate Token Usage

Check that tokens are used correctly:

```bash
# Check for direct primitive token usage (should be rare)
grep -rn "var(--color-dq-gray-\d\+)" --include="*.tsx" components/ app/
```

## Common Pitfalls

### 1. Forgetting Dark Mode

**Bad**:
```tsx
<div className="bg-[#f1f1f2]">...</div>
```

**Good**:
```tsx
<div className="bg-dialog">...</div>
```

### 2. Using Primitive Tokens Directly

**Bad**:
```tsx
<div className="bg-[var(--color-dq-gray-100)]">...</div>
```

**Good**:
```tsx
<div className="bg-light">...</div>
```

### 3. Mixing Token Systems

**Bad**:
```tsx
<div className="bg-card text-blue-500">...</div>
```

**Good**:
```tsx
<div className="bg-card text-[var(--color-text-info)]">...</div>
```

## Examples from Codebase

### Fixed: Dialog Colors

**File**: `features/ticket-card/utils/ticket-card.config.ts`

**Before**:
```tsx
"bg-[#f1f1f2] dark:bg-[#0F0F0F]"
```

**After**:
```tsx
"bg-dialog"
```

### Fixed: Project Colors

**File**: `config/tasks.config.ts`

**Before**:
```tsx
{ color: "red", bgClass: "bg-red-500" }
```

**After**:
```tsx
{ color: "red", bgClass: "bg-[var(--color-dq-red-500)]" }
```

### Fixed: Status Colors

**File**: `config/board.config.ts`

**Before**:
```tsx
iconColor: "text-blue-500"
```

**After**:
```tsx
iconColor: "text-[var(--color-text-info)]"
```

## Next Steps

1. Review remaining violations
2. Prioritize by impact
3. Migrate incrementally
4. Test thoroughly
5. Document exceptions
