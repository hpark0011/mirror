# Verification Protocol

**This is mandatory.** After ANY code change, verify before reporting completion.

## Verification Tiers

Choose the tier that matches your change. Higher tiers include all lower steps.

### Tier 1 — Types, utils, hooks, config changes

```bash
pnpm build --filter=<affected-app>
```

### Tier 2 — Component structure, imports, new files

```bash
pnpm build --filter=<affected-app>
pnpm lint --filter=<affected-app>
```

### Tier 3 — CSS, layout, animations, visual changes

```bash
pnpm build --filter=<affected-app>
pnpm lint --filter=<affected-app>
```

Then use Chrome MCP to screenshot the affected page and confirm the visual result.

### Tier 4 — Event handlers, navigation, user interactions

```bash
pnpm build --filter=<affected-app>
pnpm lint --filter=<affected-app>
```

Then use Chrome MCP to interact with the feature and confirm correct behavior.

### Tier 5 — New feature (end-to-end)

All of the above: build, lint, screenshot, and interaction test.

## Convex changes (mandatory, in addition to the tier above)

Any change under `packages/convex/convex/**` MUST also run:

```bash
pnpm --filter=@feel-good/convex run verify:codegen
```

This regenerates `convex/_generated` and fails if the committed output is
stale (`scripts/verify-convex-codegen.mjs`). A missing `_generated/api.d.ts`
entry for a new module is a recurring P0 review finding — running this
before commit catches it instead of leaving it for the next reviewer.

Constraints (Convex 1.37 reality, verified — not a lint hook):

- `convex codegen` is **not offline**: it needs a configured deployment and
  pushes functions to the worktree's dev deployment. Run it from a
  provisioned worktree (which always has `CONVEX_DEPLOYMENT`), as a
  deliberate pre-commit step.
- It is intentionally **not** wired into `pnpm lint` — lint must not mutate
  a deployment or hard-fail without credentials.
- It is **not** a CI gate as-is (CI has no Convex deployment). A true CI
  gate needs an ephemeral deployment and is tracked as separate work.

## E2E Tests

Playwright CLI only — never Playwright MCP or browser-automation MCP tools for tests.
How to write and read them (commands, the deterministic `data-*` wait convention,
reading failure output): [`.claude/rules/testing-e2e.md`](testing-e2e.md), which
auto-loads when you work under `apps/*/tests/`, `apps/*/e2e/`, or any `*.spec.ts`.

## Tool Boundaries

| Task | Tool |
|------|------|
| Build verification | `pnpm build`, `pnpm lint` |
| Visual debugging (Tier 3+) | Chrome MCP |
| Automated e2e tests | Playwright CLI (`playwright test`) |

Chrome MCP is for visual confirmation and interaction debugging — not for test assertions.

## App Filter Reference

| App | Filter |
|-----|--------|
| Mirror | `@feel-good/mirror` |
| UI Factory | `@feel-good/ui-factory` |
| Shared packages | `@feel-good/features`, `@feel-good/ui`, etc. |

For shared package changes, build the consuming app(s).

## Failure Protocol

1. If build or lint fails → fix the issue
2. Re-run verification from Tier 1 (not just the failing step)
3. Do not report completion until all checks pass

## Completion Reporting

When reporting a task as done, state:

- **What was verified** (e.g., "build passed", "screenshot confirmed layout")
- **Verification command output** (pass/fail, not full logs)
- **Screenshot** if Tier 3+

Never say "should work" or "this should fix it" — prove it.
