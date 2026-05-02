---
id: FG_101
title: "Markdown-import action caps inline images per invocation"
date: 2026-05-02
type: improvement
status: to-do
priority: p2
description: "importMarkdownInlineImages walks the full body for image nodes with no count limit. Each candidate URL gets up to FETCH_TIMEOUT_MS (10s) of fetch budget. A body with 60+ unique slow URLs exceeds Convex's 10-minute action budget; the action fails mid-flight, leaving partial blobs and a confusing error. Add a MAX_IMPORT_IMAGES_PER_ACTION constant in storage-policy.ts and slice candidates before the fetch loop."
dependencies: [FG_095]
parent_plan_id: workspace/spec/2026-04-30-tiptap-inline-image-lifecycle-spec.md
acceptance_criteria:
  - "grep -n 'MAX_IMPORT_IMAGES_PER_ACTION' packages/convex/convex/content/storage-policy.ts returns the constant export"
  - "Both articles/actions.ts and posts/actions.ts (or the shared helper from FG_095) slice candidates to MAX_IMPORT_IMAGES_PER_ACTION before the fetch loop"
  - "When the cap is hit, the surplus URLs appear in failures with a 'cap-exceeded' or similar reason, so the user sees what happened"
  - "New Vitest case: body with N+1 unique image URLs (where N = MAX_IMPORT_IMAGES_PER_ACTION) — assert exactly N are imported and the surplus is reported as failures with a clear reason"
  - "pnpm --filter=@feel-good/convex test passes"
  - "pnpm --filter=@feel-good/mirror build passes"
owner_agent: "Convex backend specialist"
---

# Markdown-import action caps inline images per invocation

## Context

ce:review (`feature-add-editor`, 2026-05-02) Finding #15, adversarial reviewer at confidence 0.82.

`packages/convex/convex/articles/actions.ts:70` `collectExternalImageSrcs` walks the full body and pushes every absolute-URL image src — no cap, no dedup at this layer (dedup happens later in the resolved/tried Sets). `posts/actions.ts:67` mirrors.

Each unique URL spends up to `FETCH_TIMEOUT_MS = 10_000` on `safeFetchImage`. With 100 unique URLs all responding slowly, the loop spends up to 1000 seconds — well beyond Convex's documented 10-minute action budget.

When the action times out:

- `ctx.storage.store` calls that already succeeded leave their blobs unreferenced (the `_patchInlineImageBody` mutation never ran).
- The action returns a synthetic error to the caller.
- The post stays in `status: 'draft'` because the client only flips to published after import success.
- Cron sweep eventually cleans the orphans (24h grace).

User-visible: "Import failed" with no useful detail, post in limbo, storage cost for the abandoned blobs.

## Goal

After this ticket, no markdown body can blow the action budget through image count alone. The cap is configurable, communicated to the user when hit, and consistent across articles and posts.

## Scope

- `packages/convex/convex/content/storage-policy.ts` — add `MAX_IMPORT_IMAGES_PER_ACTION` constant.
- Shared markdown-import helper (from FG_095) or both `actions.ts` files — apply the cap.
- Surface the cap-exceeded URLs in the `failures[]` array with a clear `reason`.
- Vitest case.

## Out of Scope

- Multi-invocation chunking — if a body has 100 images and the cap is 20, the user re-invokes; we don't auto-paginate.
- Per-host rate limiting — out of scope.
- Dynamic cap based on observed fetch latency.

## Approach

Pick a cap that is comfortably below the worst-case action budget. With 10s timeout per fetch and 600s budget, theoretical max is 60 — but real workloads include `ctx.storage.store` and `ctx.runMutation` overhead. Recommend `MAX_IMPORT_IMAGES_PER_ACTION = 20` as a safe initial value; revisit if real telemetry says otherwise.

Slice the candidates after `collectExternalImageSrcs`:

```ts
const candidates = collectExternalImageSrcs(body);
const overflow = candidates.slice(MAX_IMPORT_IMAGES_PER_ACTION);
const limited = candidates.slice(0, MAX_IMPORT_IMAGES_PER_ACTION);
// ... existing fetch loop runs over `limited` ...
for (const src of overflow) {
  failures.push({ src, reason: "import-cap-exceeded" });
}
```

Coordinate with FG_095 — if the helper is already extracted, the cap lives in the helper.

- **Effort:** Small
- **Risk:** Low — additive guardrail; legitimate bodies (under cap) are unaffected.

## Implementation Steps

1. Add `export const MAX_IMPORT_IMAGES_PER_ACTION = 20;` to `packages/convex/convex/content/storage-policy.ts` with a comment explaining the action-budget reasoning.
2. Import it where the markdown-import action body lives (shared helper if FG_095 landed; both action files otherwise).
3. After `collectExternalImageSrcs`, slice and append cap-exceeded URLs to `failures` with `reason: "import-cap-exceeded"`.
4. Update `apps/mirror/features/posts/components/markdown-upload-dialog.tsx` (or wherever failures render) to format the cap-exceeded reason gracefully.
5. Add Vitest case: seed a body with N+1 unique URLs, mock all fetches as success, assert N imported + 1 in failures with the expected reason.
6. Run all tests and build.

## Constraints

- The cap must be a single source of truth (storage-policy.ts) — not duplicated.
- Existing behavior for bodies under the cap is unchanged.
- The failure reason string is part of the action's return shape — once set, treat as part of the API.

## Resources

- ce:review run artifact: `.context/compound-engineering/ce-review/2026-05-02-feature-add-editor/findings.md` Finding #15.
- Convex action budget docs (10-minute documented limit).
- Spec NFR-06 for the parallel pattern on inline-delete cap.
