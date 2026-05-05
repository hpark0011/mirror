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

## E2E Tests

E2E tests use the Playwright CLI. Never use Playwright MCP or browser-automation MCP tools for tests.

```bash
pnpm --filter=@feel-good/mirror test:e2e    # Run all e2e tests
pnpm --filter=@feel-good/mirror test:e2e:ui # Run with Playwright UI
```

Test files go in `apps/{app}/tests/` or `apps/{app}/e2e/`.

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
