# Feel Good Monorepo

Turborepo monorepo with 2 Next.js applications and shared packages.

Full project map (apps, packages, ports, auth layers): `docs/project-map.md`.

## Quick Start

```bash
pnpm install           # Install all dependencies
pnpm dev               # Run all apps in dev mode
pnpm build             # Build all packages
pnpm lint              # Lint all packages
pnpm format            # Format all files
```

## Core Principles

- **Always Choose the Compounding Option** — You should ALWAYS choose the option that compounds, that architecturally makes the codebase less prone for error and never choose the quick wins. When a bug or feedback reveals a gap in a skill, rule, convention, or template, patch the upstream artifact before (or alongside) fixing the downstream instance.

## Git Workflow

Never commit directly to main. Always use feature branches. When a merge conflict or branch divergence occurs, stop and ask the user before force-pushing or resetting.

## Task Management

Work items tracked in `workspace/tickets/` using the `generate-issue-tickets` skill.
For bug investigations, use the `/project-debug` skill (hypothesis-first protocol).

## Topic Rules

Path- and topic-scoped guidance lives in `.claude/rules/` — load the relevant file when working in that area:

| Topic             | File                                 |
| ----------------- | ------------------------------------ |
| Auth              | `.claude/rules/auth.md`              |
| Convex backend    | `.claude/rules/convex.md`            |
| Forms             | `.claude/rules/forms.md`             |
| React components  | `.claude/rules/react-components.md`  |
| State management  | `.claude/rules/state-management.md`  |
| Tailwind          | `.claude/rules/tailwind.md`          |
| TypeScript        | `.claude/rules/typescript.md`        |
| Providers         | `.claude/rules/providers.md`         |
| File organization | `.claude/rules/file-organization.md` |
| Testing           | `.claude/rules/testing.md`           |
| Verification      | `.claude/rules/verification.md`      |
| Dev process       | `.claude/rules/dev-process.md`       |
| App-specific      | `.claude/rules/apps/`                |
| Sentry            | `.claude/rules/sentry/`              |
