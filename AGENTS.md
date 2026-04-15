# Feel Good Monorepo

Turborepo monorepo with 3 Next.js applications and shared packages.

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
```

## Monorepo Structure

```
apps/           Next.js applications (greyboard, mirror, ui-factory)
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

## Packages

| Package                    | Purpose                                                 | Example Import                    |
| -------------------------- | ------------------------------------------------------- | --------------------------------- |
| @feel-good/ui              | shadcn/ui primitives                                    | `@feel-good/ui/primitives/button` |
| @feel-good/features        | Feature components (auth, dock, editor, theme)          | `@feel-good/features/auth/blocks` |
| @feel-good/icons           | SVG icon components                                     | `@feel-good/icons`                |
| @feel-good/utils           | Utilities (cn, etc.)                                    | `@feel-good/utils/cn`             |
| @feel-good/convex          | Convex backend                                          | `@feel-good/convex`               |
| @feel-good/greyboard-core  | Greyboard domain core (types, config, persistence)      | `@feel-good/greyboard-core/types` |
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
- **Always Choose the Compounding Option** — You should ALWAYS choose the option that compounds, that architecturally makes the codebase less prone for error and never choose the quick wins. When a bug or feedback reveals a gap in a skill, rule, convention, or template, patch the upstream artifact before (or alongside) fixing the downstream instance.

## Git Workflow

Never commit directly to main. Always use feature branches. When a merge conflict or branch divergence occurs, stop and ask the user before force-pushing or resetting.

## Verification

- **Always hard-verify fixes.** After editing a file, re-read it to confirm the change landed correctly, then run the relevant build/lint/test command and check the output. Never assume a fix worked — prove it.
- **Never ask the user to verify visually.** Do not tell the user to "go to localhost:3000 and check". Start the dev server yourself, then use Chrome MCP (screenshot, inspect, interact) or Playwright CLI to verify the change and share the proof directly in the conversation.

## Task Management

- **Work items**: Tracked in `workspace/tickets/` using the `generate-issue-tickets` skill. See `.claude/skills/generate-issue-tickets/SKILL.md`.
- **`compound-engineering:file-todos` plugin**: References a removed system. Use the local `generate-issue-tickets` skill instead.

## Topic Rules

Path- and topic-scoped guidance lives in `.claude/rules/` — load the relevant file when working in that area:

| Topic               | File                                     |
| ------------------- | ---------------------------------------- |
| Convex backend      | `.claude/rules/convex.md`                |
| Forms               | `.claude/rules/forms.md`                 |
| React components    | `.claude/rules/react-components.md`      |
| State management    | `.claude/rules/state-management.md`      |
| Tailwind            | `.claude/rules/tailwind.md`              |
| TypeScript          | `.claude/rules/typescript.md`            |
| Providers           | `.claude/rules/providers.md`             |
| File organization   | `.claude/rules/file-organization.md`     |
| Testing             | `.claude/rules/testing.md`               |
| Verification        | `.claude/rules/verification.md`          |
| Dev process         | `.claude/rules/dev-process.md`           |
| Git worktrees       | `.claude/rules/git-worktrees.md`         |
| App-specific        | `.claude/rules/apps/`                    |
| Sentry              | `.claude/rules/sentry/`                  |
