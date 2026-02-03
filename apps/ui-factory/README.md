# UI Factory

Design system showcase and component playground for Feel Good apps.

## Overview

UI Factory is an interactive component library where developers and designers can:

- Preview `@feel-good/ui` primitive components
- View component variants with different sizes and states
- Explore authentication UI blocks (login/sign-up)
- Test dark/light mode theming

**Port:** 3002

## Quick Start

```bash
# From monorepo root
pnpm dev --filter=@feel-good/ui-factory

# From this directory
pnpm dev
```

## Structure

```
app/
├── components/           # Component showcase pages
│   ├── buttons/          # Button variants
│   ├── input/            # Input variants
│   ├── switch/           # Switch variants
│   └── sidebar/          # Sidebar (coming soon)
├── blocks/               # Authentication UI blocks
│   ├── login/            # Login form variations
│   └── sign-up/          # Sign-up form variations
├── fonts/                # Custom font configuration
├── views/                # Root view component
├── layout.tsx            # Root layout
└── page.tsx              # Home page

components/               # Shared layout components
├── app-sidebar.tsx       # Navigation sidebar
├── sidebar-layout.tsx    # Main layout wrapper
├── nav-header.tsx        # Top header with controls
└── theme-toggle-button.tsx

config/
└── navigation.config.ts  # Navigation structure

providers/
└── root-provider.tsx     # Theme & Sidebar context

styles/                   # CSS files (Tailwind + custom)
```

## Tech Stack

- Next.js 15 (App Router)
- React 19
- Tailwind CSS
- next-themes (dark/light mode)
- Radix UI colors

## Dependencies

- `@feel-good/ui` - Shared UI components
- `@feel-good/icons` - Icon components

## Adding New Components

1. Create a new directory under `app/components/[component-name]/`
2. Add `page.tsx` with the showcase view
3. Create `_components/` for component-specific files
4. Update `config/navigation.config.ts` to add navigation entry

## Related Documentation

See `CLAUDE.md` for additional development guidelines.
