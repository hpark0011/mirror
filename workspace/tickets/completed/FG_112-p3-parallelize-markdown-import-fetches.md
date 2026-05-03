---
id: FG_112
title: "Markdown-import action fetches images concurrently with Promise.allSettled"
date: 2026-05-02
type: perf
status: completed
priority: p3
description: "importMarkdownInlineImages fetches each image sequentially via for-of + await safeFetchImage. For N=10 images at ~500ms each, total wall clock is 5s vs ~500ms with Promise.allSettled. Convex actions run in Node and support full concurrency. Parallelize the fetch loop while preserving the dedup-via-tried-Set behavior and per-image failure recording."
dependencies: [FG_095, FG_101]
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "The fetch+store loop in articles/actions.ts and posts/actions.ts (or the shared helper from FG_095) uses Promise.allSettled (or equivalent concurrent execution) — not sequential awaits"
  - "Tried/dedup behavior preserved (each unique URL fetched at most once, even on parallel re-attempts)"
  - "Per-image failure list still populated with the same shape and reason codes"
  - "MAX_IMPORT_IMAGES_PER_ACTION cap (FG_101) still applies"
  - "New Vitest: body with 5 unique image URLs, mock safeFetchImage to take 100ms each — assert total handler duration <300ms (vs >500ms sequential)"
  - "Existing FR-08 import tests pass"
  - "pnpm --filter=@feel-good/convex test passes"
owner_agent: "Convex backend / perf specialist"
---

# Markdown-import action fetches images concurrently with Promise.allSettled

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #34 (performance reviewer at confidence 0.75; also surfaced by adversarial as a budget-amplification factor for FG_101).

`packages/convex/convex/articles/actions.ts:74-94` (after FG_014's `tried` Set landed):

```ts
for (const src of candidates) {
  if (resolved.has(src) || tried.has(src)) continue;
  tried.add(src);
  try {
    const blob = await safeFetchImage(src);
    const storageId = await ctx.storage.store(blob);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) { failures.push(...); continue; }
    resolved.set(src, { storageId, src: url });
  } catch (err) { failures.push(...); }
}
```

Three sequential awaits per image. For 10 unique URLs at ~500ms each, wall-clock is ~15s. Convex actions are Node — concurrent fetches are supported and free.

After FG_101 caps the candidate count at e.g. 20, sequential 10s/image worst case is 200s. Parallelizing to ~10s worst case removes that budget pressure.

## Goal

After this ticket, N image fetches complete in roughly max-fetch-time, not sum-of-fetch-times. The action finishes faster, the budget pressure relaxes, and the user sees imports complete quicker.

## Scope

- Shared markdown-import helper (after FG_095) or both `actions.ts` files — concurrent fetch loop.
- Preserve `tried` dedup, failure recording, idempotency check.
- Vitest case asserting concurrent execution.

## Out of Scope

- Per-host rate limiting (a malicious markdown body could fan out to many requests against one host).
- Backoff / retry — single attempt per URL.

## Approach

```ts
const uniqueCandidates = Array.from(new Set(candidates));
const limited = uniqueCandidates.slice(0, MAX_IMPORT_IMAGES_PER_ACTION);
const overflow = uniqueCandidates.slice(MAX_IMPORT_IMAGES_PER_ACTION);

const settled = await Promise.allSettled(
  limited.map(async (src): Promise<{ src: string; storageId: Id<"_storage">; url: string }> => {
    const blob = await safeFetchImage(src);
    const storageId = await ctx.storage.store(blob);
    const url = await ctx.storage.getUrl(storageId);
    if (!url) throw new SafeFetchError("network" /* or similar */, "storage-getUrl-null");
    return { src, storageId, url };
  })
);

for (let i = 0; i < settled.length; i++) {
  const result = settled[i]!;
  const src = limited[i]!;
  if (result.status === "fulfilled") {
    resolved.set(result.value.src, { storageId: result.value.storageId, src: result.value.url });
  } else {
    const reason = result.reason instanceof SafeFetchError
      ? result.reason.code
      : result.reason instanceof Error
        ? result.reason.message
        : "unknown";
    failures.push({ src, reason });
  }
}

for (const src of overflow) {
  failures.push({ src, reason: "import-cap-exceeded" });
}
```

Note: dedup via `Set` happens BEFORE Promise.allSettled — so duplicate URLs in the body are fetched once, not N times. This subsumes the `tried` Set.

- **Effort:** Small
- **Risk:** Low — Convex actions support Node concurrency; Promise.allSettled is standard.

## Implementation Steps

1. Coordinate with FG_095 (shared helper) and FG_101 (cap constant).
2. Replace the for-of fetch loop with `const unique = [...new Set(candidates)]` then `Promise.allSettled` over `unique.slice(0, cap)`.
3. Map settled results back into `resolved` Map and `failures` array.
4. Add cap-exceeded entries for overflow.
5. Add Vitest case asserting parallel timing (mock safeFetchImage with deterministic delay; assert total time well below sequential).
6. Run all tests.

## Constraints

- No regression on dedup behavior — same URL fetched at most once.
- No regression on failure recording — same `{ src, reason }` shape.
- Do not exceed `MAX_IMPORT_IMAGES_PER_ACTION` concurrent fetches (the cap also caps concurrency since allSettled runs the array as-is).

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #34.
- `packages/convex/convex/articles/actions.ts:74-94` and `posts/actions.ts` equivalent.
- FG_095 (shared helper extraction) and FG_101 (cap constant) — coordinate.
