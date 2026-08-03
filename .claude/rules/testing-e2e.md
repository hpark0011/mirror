---
paths:
  - "apps/*/tests/**"
  - "apps/*/e2e/**"
  - "**/*.spec.ts"
  - "**/*.spec.tsx"
  - "**/playwright.config.*"
---

# E2E Testing

Companion to `.claude/rules/verification.md` (always loaded). This file covers
how to write and read Playwright tests; the verification tiers live there.

E2E tests use the Playwright CLI. Never use Playwright MCP or browser-automation MCP tools for tests.

```bash
pnpm --filter=@feel-good/mirror test:e2e    # Run all e2e tests
pnpm --filter=@feel-good/mirror test:e2e:ui # Run with Playwright UI
```

Test files go in `apps/{app}/tests/` or `apps/{app}/e2e/`.

## Deterministic e2e waits

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

## Reading test failures

When a Playwright run fails it prints a path like `test-results/<hash>/error-context.md`. Read that path directly — never `cat <path> | head -N`. Read takes `limit`/`offset` and skips the Bash overhead.

Same pattern for sub-agent results at `/private/tmp/claude-501/<project>/<session>/tasks/<id>.output`: Read the path the harness returns; don't pipe `cat` through `tail`.
