# Feel Good Monorepo

Turborepo monorepo with 3 Next.js applications, 1 Electron desktop application, and shared packages.

## Quick Start

```bash
pnpm install           # Install all dependencies
pnpm dev               # Run all apps in dev mode
pnpm build             # Build all packages
pnpm lint              # Lint all packages
pnpm format            # Format all files
pnpm clean             # Clean all packages
```

### Filtered Commands

```bash
pnpm dev --filter=@feel-good/greyboard    # Run single app
pnpm build --filter=@feel-good/greyboard  # Build single app
pnpm lint --filter=@feel-good/greyboard   # Lint single app
pnpm dev --filter=@feel-good/greyboard-desktop   # Run desktop app
```

### Desktop Commands

```bash
pnpm desktop:dev         # Run desktop app dev
pnpm desktop:build       # Build desktop app
pnpm desktop:dist        # Package desktop app
pnpm desktop:lint        # Lint desktop app
pnpm desktop:check-types # Typecheck desktop app
```

## Monorepo Structure

```
apps/           Next.js and Electron applications (greyboard, mirror, ui-factory, greyboard-desktop)
packages/       Shared libraries (ui, features, icons, utils, convex, tavus)
tooling/        Shared configs (eslint, prettier, typescript, sentry)
docs/           Conventions, plans, brainstorms, solutions
workspace/      Ticket tracking system
```

## Apps

| App               | Description                        | Port |
| ----------------- | ---------------------------------- | ---- |
| greyboard         | AI-powered task management         | 3000 |
| mirror            | Interactive blogging platform      | 3001 |
| ui-factory        | Design system showcase             | 3002 |
| greyboard-desktop | Electron desktop app for Greyboard | N/A  |

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

### Auth Package Layers

| Layer  | Import                                      | Purpose                   |
| ------ | ------------------------------------------- | ------------------------- |
| Blocks | `@feel-good/features/auth/blocks`           | Drop-in page sections     |
| Forms  | `@feel-good/features/auth/components/forms` | Complete forms with logic |
| Views  | `@feel-good/features/auth/views`            | Pure UI components        |
| Hooks  | `@feel-good/features/auth/hooks`            | Headless auth logic       |

## Testing

When testing browser/UI behavior, use CLI-based tools (e.g., Playwright CLI) rather than browser extension MCPs or Chrome MCP unless explicitly asked. Never default to Playwright MCP plugin.

## Debugging

Before attempting any fix for a bug, follow the `/debug` protocol:

1. State your hypothesis for the root cause
2. Describe what evidence would confirm or refute it
3. Add instrumentation/logging to gather that evidence
4. Only after confirming the root cause, propose a fix

Do NOT skip to a theoretical fix.

## Core Principles

- **Simplicity First** — Make every change as simple as possible. Impact minimal code.
- **No Laziness** — Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact** — Changes should only touch what is necessary. Avoid introducing bugs.

## Git Workflow

Never commit directly to main. Always use feature branches. When a merge conflict or branch divergence occurs, stop and ask the user before force-pushing or resetting.

## Verification

- **Always hard-verify fixes.** After editing a file, re-read it to confirm the change landed correctly, then run the relevant build/lint/test command and check the output. Never assume a fix worked — prove it.
- **Never ask the user to verify visually.** Do not tell the user to "go to localhost:3000 and check". Use `preview_*` tools (preview_start, preview_screenshot, preview_snapshot, preview_inspect, etc.) to start the dev server, take screenshots, inspect elements, and verify changes yourself. Share proof (screenshots, snapshots) directly in the conversation.

## Task Management

- **Work items**: Tracked in `workspace/tickets/` using the `generate-issue-tickets` skill. See `.claude/skills/generate-issue-tickets/SKILL.md`.
- **`compound-engineering:file-todos` plugin**: References a removed system. Use the local `generate-issue-tickets` skill instead.
