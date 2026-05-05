---
id: FG_130
title: "_generated/api.d.ts matches the canonical convex codegen output"
date: 2026-05-05
type: chore
status: to-do
priority: p1
description: "The generated api.d.ts shrank 27135 to 172 lines on this branch with no convex CLI version change in pnpm-lock — confirm which form is correct and regenerate the wrong branch before merge."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "Running `pnpm --filter=@feel-good/convex exec convex codegen` from a clean checkout of `main` produces the same api.d.ts shape as the resolved-canonical form."
  - "Both branches' api.d.ts agree on whether `components.agent`, `betterAuth`, `rateLimiter`, `resend` are inlined function references OR opaque `ComponentApi<...>` references."
  - "`pnpm build --filter=@feel-good/mirror` passes against the canonical api.d.ts shape."
  - "`pnpm --filter=@feel-good/convex exec tsc --noEmit` passes."
owner_agent: "convex backend engineer"
---

# _generated/api.d.ts matches the canonical convex codegen output

## Context

Surfaced by the PR #34 code review (`code-review-pr34` batch; data-integrity reviewer). `packages/convex/convex/_generated/api.d.ts` shrank from 27135 lines on `main` to 172 lines on `feature-article-editor`. main inlines every component function signature for `agent`, `betterAuth`, `rateLimiter`, `resend`; HEAD uses opaque `ComponentApi<...>` references via `import("@convex-dev/agent/_generated/component.js").ComponentApi<"agent">` etc.

`convex.config.ts` is identical on both branches (still uses all four components). pnpm-lock shows ZERO change to `convex@version` — both branches resolve `convex@1.37.0`.

**Risk:** whichever form does NOT match what `convex codegen` would produce today is stale. A teammate or CI on main running `npx convex codegen` will silently regenerate the 27K-line form and revert this file. Worse, if HEAD's form is canonical and main's is stale, any code on main that imports from the inlined component signatures is referencing phantom types.

## Goal

The generated `api.d.ts` matches what `convex codegen` produces against the locked dependency versions, eliminating the silent-regen risk.

## Scope

- Determine which form is canonical by running `convex codegen` in a clean state.
- Regenerate (or restore) the correct file shape.
- If main is stale, file a follow-up to refresh main's codegen.

## Out of Scope

- Upgrading the `convex` CLI version.
- Changing the components registered in `convex.config.ts`.

## Approach

Run codegen in a clean main checkout against the locked deps; compare the output to both branches; whichever branch matches is canonical.

- **Effort:** Small
- **Risk:** Low (read-only investigation followed by a regenerate)

## Implementation Steps

1. From a clean checkout of `main` (or a fresh clone), run `pnpm install` then `pnpm --filter=@feel-good/convex exec convex codegen` and capture the output `_generated/api.d.ts`.
2. Compare line count and structure against both branch versions: `wc -l` and `head -200`.
3. If main is canonical: regenerate on this branch by re-running codegen here, commit the resulting file.
4. If HEAD is canonical: file a separate ticket to refresh main's codegen, but leave this branch as-is.
5. Verify `pnpm build --filter=@feel-good/mirror` passes against the canonical shape.
6. Document the resolution in the PR description.

## Constraints

- Do not hand-edit `_generated/api.d.ts` — it must come from `convex codegen`.
- Must not change `convex.config.ts` or any registered components.

## Resources

- PR #34: https://github.com/hpark0011/mirror/pull/34
- Convex codegen docs: https://docs.convex.dev/cli#run-the-convex-dev-server
