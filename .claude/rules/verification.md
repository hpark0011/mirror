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

E2E tests use the Playwright CLI. Never use Playwright MCP or browser-automation MCP tools for tests.

```bash
pnpm --filter=@feel-good/mirror test:e2e    # Run all e2e tests
pnpm --filter=@feel-good/mirror test:e2e:ui # Run with Playwright UI
```

Test files go in `apps/{app}/tests/` or `apps/{app}/e2e/`.

### Deterministic e2e waits

**Never use `page.waitForTimeout(<ms>)` to bridge async work.** Fixed delays are flaky on slow CI, mask ordering bugs, and almost always get flagged in code review. The mirror app enforces this with an ESLint rule (`no-restricted-syntax` in `apps/mirror/eslint.config.mjs`) — `pnpm lint` will fail.

The convention: any UI operation with async work exposes a `data-<feature>` attribute that flips when the work settles, and tests wait on that flip.

**Producer side (component):**

```tsx
<section data-cover-uploading={isUploading ? "true" : "false"}>
  …
</section>
```

**Consumer side (e2e test):**

```ts
import { waitForDataState } from "./helpers/wait-for-data-state";

await page.getByRole("button", { name: "Upload cover" }).click();
await waitForDataState(page, "cover-uploading", "false"); // not waitForTimeout(500)
await expect(page.getByRole("img", { name: "Cover" })).toBeVisible();
```

**Naming:** `data-<feature>-<verb>ing` (e.g. `data-cover-uploading`, `data-chat-resolving`, `data-comment-posting`). Use string values (`"true"` / `"false"`) — Playwright's attribute selector `[…="false"]` requires it.

**Escape hatch:** if you genuinely need a fixed wall-clock delay (animation throttle, third-party clock dependency), add `// eslint-disable-next-line no-restricted-syntax -- <one-line reason>` on the same line. Anything not explainable in one line is the rule firing correctly — go add the data-attribute.

### Reading test failures

When a Playwright run fails it prints a path like `test-results/<hash>/error-context.md`. Read that path directly — never `cat <path> | head -N`. Read takes `limit`/`offset` and skips the Bash overhead.

Same pattern for sub-agent results at `/private/tmp/claude-501/<project>/<session>/tasks/<id>.output`: Read the path the harness returns; don't pipe `cat` through `tail`.

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
