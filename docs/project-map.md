# Project Map

Reference orientation for the Feel Good monorepo — extracted from `AGENTS.md`
so it's available on demand without loading on every agent turn.

## Monorepo Structure

```
apps/           Next.js applications (mirror, ui-factory)
packages/       Shared libraries (ui, features, icons, utils, convex, tavus)
tooling/        Shared configs (eslint, prettier, typescript, sentry)
docs/           Conventions, plans, brainstorms, solutions
workspace/      Ticket tracking system
```

## Apps

| App        | Description                   | Port |
| ---------- | ----------------------------- | ---- |
| mirror     | Interactive blogging platform | 3001 |
| ui-factory | Design system showcase        | 3002 |

## Packages

| Package                    | Purpose                                                 | Example Import                    |
| -------------------------- | ------------------------------------------------------- | --------------------------------- |
| @feel-good/ui              | shadcn/ui primitives                                    | `@feel-good/ui/primitives/button` |
| @feel-good/features        | Feature components (auth, dock, editor, theme)          | `@feel-good/features/auth/blocks` |
| @feel-good/icons           | SVG icon components                                     | `@feel-good/icons`                |
| @feel-good/utils           | Utilities (cn, etc.)                                    | `@feel-good/utils/cn`             |
| @feel-good/convex          | Convex backend                                          | `@feel-good/convex`               |
| @feel-good/tavus           | Tavus CVI video calling                                 | `@feel-good/tavus/client`         |
| @feel-good/tsconfig        | Shared TypeScript configs (base, react-library, nextjs) | —                                 |
| @feel-good/eslint-config   | Shared ESLint configurations                            | —                                 |
| @feel-good/prettier-config | Shared Prettier configuration                           | —                                 |
| @feel-good/sentry-config   | Shared Sentry configuration for Next.js                 | `@feel-good/sentry-config/nextjs` |

## Auth Package Layers

| Layer  | Import                                      | Purpose                   |
| ------ | ------------------------------------------- | ------------------------- |
| Blocks | `@feel-good/features/auth/blocks`           | Drop-in page sections     |
| Forms  | `@feel-good/features/auth/components/forms` | Complete forms with logic |
| Views  | `@feel-good/features/auth/views`            | Pure UI components        |
| Hooks  | `@feel-good/features/auth/hooks`            | Headless auth logic       |

## Filtered Commands

```bash
pnpm dev --filter=@feel-good/mirror    # Run single app
pnpm build --filter=@feel-good/mirror  # Build single app
pnpm lint --filter=@feel-good/mirror   # Lint single app
```
