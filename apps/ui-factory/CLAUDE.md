# UI Factory

Design system showcase and component playground for Feel Good apps.

## Commands

```bash
pnpm dev          # Start dev server (http://localhost:3002)
pnpm build        # Production build
pnpm lint         # ESLint - MUST pass before commits
```

Or from monorepo root:

```bash
pnpm dev --filter=@feel-good/ui-factory
```

## Tech Stack

| Category  | Technology                                      |
| --------- | ----------------------------------------------- |
| Framework | Next.js 15 (App Router), React 19, TypeScript   |
| Styling   | Tailwind CSS, @feel-good/ui                     |
| Theming   | next-themes                                     |

## Purpose

- Component playground for testing @feel-good/ui primitives
- Design token visualization
- Pattern documentation and examples
- Interactive component demos

## Dependencies

- `@feel-good/ui` - Shared UI components to showcase
