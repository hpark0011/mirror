---
id: FG_109
title: "safeFetchImage applies a per-hop timeout in addition to the global budget"
date: 2026-05-02
type: improvement
status: to-do
priority: p3
description: "safeFetchImage uses a single AbortController whose 10s timer starts before the redirect loop. With MAX_FETCH_REDIRECTS=3, a slow first hop responding at 9.9s leaves only 100ms for subsequent hops + body read. An attacker controlling a slow-responding redirect target can starve the body-size check. Add a per-hop timeout in addition to the global cap."
dependencies: []
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "safeFetchImage uses a per-hop AbortController (resets on each redirect) AND respects the global FETCH_TIMEOUT_MS as an outer bound"
  - "New Vitest case: mock fetch to delay each hop by N seconds; assert behavior under 4 redirects×3s/hop scenario completes correctly without consuming the global budget unfairly"
  - "Existing safe-fetch redirect / timeout tests still pass"
  - "pnpm --filter=@feel-good/convex test passes"
owner_agent: "Convex backend / network specialist"
---

# safeFetchImage applies a per-hop timeout in addition to the global budget

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #31, security + adversarial reviewers at confidence 0.65.

`packages/convex/convex/content/safe-fetch.ts:66-67`:

```ts
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
```

The single 10-second timer covers the entire `safeFetchImage` execution including redirect chain. With `MAX_FETCH_REDIRECTS = 3`, an attacker controlling intermediate hosts can return slow 302 responses that consume most of the global budget before the final hop is even initiated. The body-size check at the final hop runs against an already-near-expired timeout, so streaming a large body could be aborted prematurely (DoS-adjacent), or — combined with a DNS-rebinding attack — could compress the resolution-to-fetch window.

The DNS rebinding non-property is acknowledged out of scope. This finding is about giving the body-size check a fair time budget independent of redirect-chain duration.

## Goal

After this ticket, slow redirect chains do not starve the body-size check. Each hop has a bounded fraction of the global budget; the global budget remains an outer cap against pathological cases.

## Scope

- `packages/convex/convex/content/safe-fetch.ts` — per-hop AbortController.
- Vitest update to model multi-hop slowness.

## Out of Scope

- DNS rebinding mitigation (NFR-01 carve-out).
- Total-budget tuning — `FETCH_TIMEOUT_MS = 10_000` stays.

## Approach

Keep the global controller as the outer bound; create a per-hop controller as the inner bound. The per-hop budget can be `Math.floor(FETCH_TIMEOUT_MS / (MAX_FETCH_REDIRECTS + 1))` so the worst case is the global budget, but the typical case grants each hop a fair share.

```ts
const globalController = new AbortController();
const globalTimeout = setTimeout(() => globalController.abort(), FETCH_TIMEOUT_MS);
const PER_HOP_MS = Math.floor(FETCH_TIMEOUT_MS / (MAX_FETCH_REDIRECTS + 1));

try {
  let currentUrl = url;
  for (let hop = 0; hop <= MAX_FETCH_REDIRECTS; hop++) {
    const hopController = new AbortController();
    const hopTimeout = setTimeout(() => hopController.abort(), PER_HOP_MS);
    // Combine signals: abort if either fires.
    const combined = new AbortController();
    globalController.signal.addEventListener("abort", () => combined.abort());
    hopController.signal.addEventListener("abort", () => combined.abort());

    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        signal: combined.signal,
      });
    } finally {
      clearTimeout(hopTimeout);
    }
    // ... rest of hop logic ...
  }
} finally {
  clearTimeout(globalTimeout);
}
```

Note: `AbortSignal.any([global, hop])` is the cleaner pattern in Node 20+; check Convex's runtime support. Fall back to manual signal combination if needed.

- **Effort:** Small
- **Risk:** Low — adds an inner timeout bound; existing global cap untouched.

## Implementation Steps

1. Refactor `safeFetchImage` to use per-hop controllers as described.
2. If `AbortSignal.any` is available in the Convex Node runtime, prefer it.
3. Add a Vitest case that mocks fetch with a slow delay per hop and asserts the per-hop bound applies.
4. Run all safe-fetch tests.

## Constraints

- The global 10s outer bound must remain — pathological cases shouldn't run forever.
- Per-hop timeout must be tunable via a constant (consider exporting `FETCH_PER_HOP_TIMEOUT_MS`).
- Behavior on the happy path (single hop, fast response) must be unchanged.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #31.
- `packages/convex/convex/content/safe-fetch.ts:65-166` — implementation site.
- Spec NFR-01.
