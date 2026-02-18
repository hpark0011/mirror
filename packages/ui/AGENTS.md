# @feel-good/ui

Shared UI component library based on shadcn/ui primitives.

## Installation

Add to your app's dependencies:

```json
{
  "dependencies": {
    "@feel-good/ui": "workspace:*"
  }
}
```

## Usage

```typescript
// Import primitives
import { Button } from "@feel-good/ui/primitives/button";
import { Card } from "@feel-good/ui/primitives/card";
import { Dialog } from "@feel-good/ui/primitives/dialog";

// Import hooks
import { useMediaQuery } from "@feel-good/ui/hooks/use-media-query";

// Import providers
import { ThemeProvider } from "@feel-good/ui/providers/theme-provider";

// Import styles (in layout/app)
// See globals.css example below.
```

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
```

## Structure

```
src/
├── primitives/       # shadcn/ui base components
├── components/       # Custom components & Composed components
├── hooks/            # UI-related hooks
├── providers/        # Context providers (theme, etc.)
├── lib/              # Utilities (cn, etc.)
└── styles/           # Global CSS
```

## Adding New Components

1. If it's from shadcn/ui, create in `src/primitives/`
2. If it's a custom component, create in `src/components/`
3. Add export to `package.json` exports field
4. Run `pnpm install` from monorepo root

## Dependencies

Uses Radix UI primitives, class-variance-authority, and Tailwind CSS.

## Dependency Management

When adding packages to package.json, follow these rules:

dependencies - Add packages that:

- Are imported and used in exported components/code
- Are bundled with the library and needed at runtime
- Examples: clsx, tailwind-merge, lucide-react, react-dropzone

devDependencies - Add packages that:

- Are build/dev tools: eslint, prettier, typescript, @kit/eslint-config
- Are type-only packages: @types/react, @types/react-dom
- Are used internally but not exported (peer dependencies):
  - Packages provided by consuming apps (e.g., react-i18next, next, react-hook-form, zod)
  - Used for type checking/development but expected to be provided at runtime
- Examples: react-i18next, next, react-hook-form, zod, @supabase/supabase-js

Rule of thumb: If a package is imported in exported code AND the consuming app doesn't provide it → dependencies. Otherwise → devDependencies.

## Styling

- Tailwind CSS v4 with semantic classes
- Prefer: `bg-background`, `text-muted-foreground`, `border-border`
- Use `cn()` for class merging
- Never use hardcoded colors like `bg-white`

## Key Components

| Component | Usage                 |
| --------- | --------------------- |
| `If`      | Conditional rendering |
| `Trans`   | Internationalization  |
| `toast`   | Notifications         |
| `Form*`   | Form fields           |
| `Button`  | Actions               |

## Testing

Run TS check for `@feel-good/ui` before you push.

Steps

1. Run a no-emit typecheck using workspace TypeScript:
  - Command: `tsc -p packages/ui/tsconfig.json --noEmit`
2. If the command fails because tsc isn't found or dependencies aren't installed:
  - Install deps at the repo root: pnpm install
  - Re-run the typecheck command from step 1.
