# @feel-good/ui

Shared UI component library based on shadcn/ui, Tailwind CSS v4, Radix UI, and class-variance-authority (CVA). Uses a three-layer CSS token architecture that maps Radix color scales through semantic custom properties into Tailwind utility classes.

## Installation

```json
{ "dependencies": { "@feel-good/ui": "workspace:*" } }
```

## Package Structure

```
src/
├── primitives/       # 53 shadcn/ui base components
├── components/       # 4 custom components (icon, if, trans, shiny-button)
├── hooks/            # 2 hooks (use-media-query, use-mobile)
├── providers/        # 1 provider (theme-provider)
├── lib/              # 1 utility (utils.ts — re-exports cn)
└── styles/           # CSS token files (see docs/conventions/css-token-file-convention.md)
```

## Export System

Wildcard exports in `package.json` — no barrel files needed:

```json
{
  "exports": {
    "./primitives/*": "./src/primitives/*.tsx",
    "./components/*": "./src/components/*.tsx",
    "./providers/*": "./src/providers/*.tsx",
    "./hooks/*": "./src/hooks/*.tsx",
    "./lib/utils": "./src/lib/utils.ts",
    "./styles.css": "./src/styles/globals.css",
    "./styles/*": "./src/styles/*"
  }
}
```

```typescript
import { Button } from "@feel-good/ui/primitives/button";
import { If } from "@feel-good/ui/components/if";
import { useMediaQuery } from "@feel-good/ui/hooks/use-media-query";
import { ThemeProvider } from "@feel-good/ui/providers/theme-provider";
import { cn } from "@feel-good/ui/lib/utils";
```

## CSS Architecture

### Three-Layer Token System

```
Layer 1: Radix Color Scales (@radix-ui/colors)
  --gray-1..12, --red-1..12, --green-1..12, --grass-1..12
  Auto light/dark via separate CSS imports
    ↓
Layer 2: Semantic Custom Properties (:root / .dark)
  --primary, --background, --border, etc. referencing Radix steps
    ↓
Layer 3: Tailwind Theme Registration (@theme inline)
  --color-primary: var(--primary) → enables bg-primary, text-primary, etc.
```

Consuming apps must import Radix color CSS **before** `@feel-good/ui/styles.css`:

```css
@import "@radix-ui/colors/gray.css";
@import "@radix-ui/colors/gray-dark.css";
@import "@radix-ui/colors/red.css";
@import "@radix-ui/colors/red-dark.css";
@import "@radix-ui/colors/green.css";
@import "@radix-ui/colors/green-dark.css";
@import "@radix-ui/colors/grass.css";
```

**Dark mode**: Class-based via `next-themes` with `@custom-variant dark (&:is(.dark *));`. The `ThemeProvider` sets `.dark` on `<html>`. No `prefers-color-scheme` media queries.

**Body defaults**: `letter-spacing: -0.04em`, `font-weight: 480`, `font-family: var(--font-sans)`.

### Style Files

One CSS file per component that owns exclusive tokens, plus system-level files. See `docs/conventions/css-token-file-convention.md` for the full split rule and three-layer contract.

| File | Purpose |
| --- | --- |
| `globals.css` | Hub. System tokens (base, border, icon, text) + imports + `@layer base`. |
| `radix-color-scale.css` | Bridges Radix `--gray-1..12` etc. into Tailwind `@theme inline`. |
| `fonts.css` | Font families: `--font-sans` (Inter), `--font-serif` (Instrument Serif), `--font-mono` (Geist Mono). |
| `shadows.css` | Cross-component shadow tokens (button, dock, shiny-button). |
| `{component}.css` | Component-specific tokens (button, dialog, input, switch, field, sidebar, popover). |

Read the source CSS files in `src/styles/` for exact token values. `ls src/styles/` for the current file list.

## Integration Guide

### Minimal `globals.css`

```css
@import "tailwindcss";
@import "tw-animate-css";

@import "@radix-ui/colors/gray.css";
@import "@radix-ui/colors/gray-dark.css";
@import "@radix-ui/colors/red.css";
@import "@radix-ui/colors/red-dark.css";
@import "@radix-ui/colors/green.css";
@import "@radix-ui/colors/green-dark.css";
@import "@radix-ui/colors/grass.css";

@import "@feel-good/ui/styles.css";

@source "../node_modules/@feel-good/ui";
```

Import order matters — Radix CSS must precede `@feel-good/ui/styles.css`. Add `@source "../node_modules/@feel-good/features";` if using that package.

### Font Variable Mapping

Fonts load via `next/font` in the consuming app, applied as CSS variable classes on `<body>`:

| `next/font` variable | Maps to | Font |
| --- | --- | --- |
| `--font-inter-variable` | `--font-sans` | Inter |
| `--font-instrument-serif` | `--font-serif` | Instrument Serif |
| `--font-geist-mono` | `--font-mono` | Geist Mono |

### Customizing Tokens

Override tokens by adding `:root` / `.dark` blocks **after** importing `@feel-good/ui/styles.css`. New tokens need a local `@theme inline` block to register with Tailwind.

## Components

53 primitives in `src/primitives/`, 4 custom components (icon, if, trans, shiny-button), 2 hooks (use-media-query, use-mobile), 1 provider (theme-provider), 1 utility (lib/utils re-exports `cn`). Run `ls src/primitives/` for the full list.

## Component Patterns

**CVA variants**: Components use `class-variance-authority` for variant/size definitions with `defaultVariants`.

**`data-slot` attributes**: Every component renders `data-slot` for CSS targeting and testing.

**Semantic colors only**: Use `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border` — never hardcoded colors.

**Focus / invalid states**:
```
outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]
aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40
```

### Tooltip requires a root `TooltipProvider`

`primitives/tooltip.tsx`'s `Tooltip` does **not** self-wrap a
`TooltipProvider` (one provider per tooltip is wasteful and breaks shared
delay/skip grouping). **Every consuming app MUST mount a single
`TooltipProvider` at its root** (`apps/<app>/providers/root-provider.tsx`).
Do not rely on another primitive (e.g. `SidebarProvider`) wrapping one
internally — routes rendered outside that primitive lose tooltip context
silently (tooltips never open, no console error). Any component here that
renders `<Tooltip>` (`components/icon-button.tsx`, and editor
`toolbar-button.tsx` in `@feel-good/features`) inherits this requirement.

## Adding New Components

1. shadcn/ui components → `src/primitives/`; custom → `src/components/`
2. Wildcard exports auto-expose new files — no `package.json` update needed
3. Run `pnpm install` from monorepo root if adding new dependencies

## Dependency Management

**dependencies** — packages imported in exported components (Radix, CVA, lucide-react, next-themes, sonner). **devDependencies** — build tools, types, and packages provided by consuming apps (TypeScript, ESLint, `@types/react`, react-i18next). Rule of thumb: if imported in exported code AND the consuming app doesn't provide it, it's a dependency.

## Testing

```bash
tsc -p packages/ui/tsconfig.json --noEmit
```
