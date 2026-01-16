# Design System

Comprehensive design system for consistent, efficient, and intentional design decisions.

## Overview

This design system provides a complete set of tokens, guidelines, and patterns to ensure consistency across the application. All design decisions should reference this system.

## Quick Links

- **[Color Tokens](./colors.md)** - Complete color token reference
- **[Design Tokens](./tokens.md)** - Spacing, typography, borders, shadows
- **[Usage Guide](./usage-guide.md)** - How to use tokens in components
- **[Migration Guide](./migration-guide.md)** - Migrating hardcoded values to tokens

## Core Principles

### 1. Token Hierarchy

The design system uses a three-layer token architecture:

```
Primitive Tokens (Base Values)
    ↓
Semantic Tokens (Context-Specific)
    ↓
Component Tokens (Component-Specific)
```

**Rule**: Always prefer semantic tokens over primitive tokens. Only use component tokens for specific component types.

### 2. Consistency Over Convenience

**DO**: Use design tokens even if it's slightly more verbose
**DON'T**: Use hardcoded values for "quick fixes"

### 3. Theme-Aware by Default

All semantic tokens automatically adapt to light/dark mode. Never manually handle theme switching for semantic tokens.

### 4. Documentation First

When adding new tokens or patterns, document them immediately. Undocumented tokens are technical debt.

## Token Categories

### Colors

- **Primitive**: Base color values (`--color-dq-gray-500`)
- **Semantic**: Context-specific (`--color-text-primary`, `--color-base`)
- **Component**: Component-specific (`--card`, `--dialog`)

See [Color Tokens Reference](./colors.md) for complete details.

### Spacing

4px base unit system. Use Tailwind spacing classes (`p-4`, `gap-2`).

See [Design Tokens Reference](./tokens.md#spacing-tokens) for complete details.

### Typography

Font sizes, weights, line heights, and families.

See [Design Tokens Reference](./tokens.md#typography-tokens) for complete details.

### Borders

Border radius and width tokens.

See [Design Tokens Reference](./tokens.md#border-tokens) for complete details.

### Shadows

Base shadows and component-specific shadows (buttons, cards).

See [Design Tokens Reference](./tokens.md#shadow-tokens) for complete details.

## Usage Guidelines

### When to Use Which Token

1. **Component tokens** → Styling specific component types (cards, dialogs, buttons)
2. **Semantic tokens** → General styling (backgrounds, text, icons)
3. **Primitive tokens** → Only in CSS files to build semantic tokens

### Decision Tree

```
Is it a component type?
├─ Yes → Component token (bg-card, bg-dialog)
└─ No → Semantic token (bg-base, text-text-primary)
```

See [Usage Guide](./usage-guide.md) for detailed decision tree.

## DO's and DON'Ts

### ✅ DO

- Use semantic tokens for general styling
- Use component tokens for specific components
- Use Tailwind classes that map to tokens
- Let dark mode work automatically
- Document exceptions when needed

### ❌ DON'T

- Use primitive tokens directly in components
- Use hardcoded hex/rgb colors
- Use standard Tailwind color classes (`bg-red-500`)
- Use arbitrary spacing/typography values
- Manually handle dark mode for semantic tokens

## File Structure

```
styles/
├── primitives.css          # Base tokens (colors, spacing, typography)
├── background-colors.css   # Background semantic tokens
├── text-colors.css         # Text semantic tokens
├── icon-colors.css         # Icon semantic tokens
├── shadows.css             # Component shadow tokens
├── components.css          # Component-specific tokens
└── globals.css             # shadcn/ui tokens + Tailwind bridge
```

## Adding New Tokens

1. **Add primitive token** (if needed) to `primitives.css`
2. **Create semantic token** in appropriate file
3. **Add dark mode variant** in `.dark` selector
4. **Bridge to Tailwind** in `globals.css` `@theme inline` block
5. **Document** in appropriate reference file

## Migration Status

### ✅ Completed

- Fixed broken `--color-dq-gray-1000` reference
- Replaced hardcoded dialog colors with `bg-dialog` token
- Updated config files to use design tokens
- Created comprehensive documentation

### 🔄 In Progress

- Migrating remaining hardcoded values in components
- Standardizing component usage patterns

### 📋 TODO

- Audit all components for hardcoded values
- Create token usage linter rules
- Add Storybook examples for tokens

## Resources

- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Design Tokens W3C Spec](https://www.w3.org/community/design-tokens/)

## Questions?

Refer to the [Usage Guide](./usage-guide.md) for common patterns and examples. For migration help, see the [Migration Guide](./migration-guide.md).
