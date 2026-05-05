---
id: FG_128
title: "Content href shape has a single source of truth across client and server"
date: 2026-05-05
type: refactor
status: completed
priority: p1
description: "buildContentHref (Convex server) and getContentHref (Next.js client) both build the canonical /@<username>/<kind>/<slug> URL, kept in sync only by cross-reference comments and two parallel test suites. They are already structurally divergent — the client variant accepts an optional slug; the server variant requires one — which contradicts the comment-asserted byte-identical contract. Consolidate to one shared helper exported from @feel-good/convex (or align the function shapes and test the no-slug path on both sides)."
dependencies: []
parent_plan_id: docs/plans/2026-05-04-feat-agent-ui-parity-plan.md
acceptance_criteria:
  - "Either: a single `buildContentHref(username, kind, slug?)` is exported from `@feel-good/convex` and both `apps/mirror/features/content/types.ts` and `packages/convex/convex/chat/toolQueries.ts` import it (no parallel implementation), OR the two implementations are aligned with identical signatures and both have tests for the slug-omitted case"
  - "`grep -rn 'getContentHref\\|buildContentHref' packages/ apps/` shows callers importing one function reference (or two function references that are thin re-exports of the same implementation)"
  - "If consolidating to a shared helper: `packages/convex/package.json` exports map declares the new module path"
  - "Tests in `apps/mirror/features/content/__tests__/types.test.ts` AND `packages/convex/convex/chat/__tests__/tools.test.ts` both cover the slug-omitted path (`/@<username>/<kind>` with no trailing segment)"
  - "Cross-reference comments at `types.ts:26-30` and `toolQueries.ts:32-39` are updated to point to the shared helper, OR removed if no longer necessary"
  - "`pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror` both pass"
  - "`pnpm --filter=@feel-good/convex test:unit` and `pnpm --filter=@feel-good/mirror test:unit` both pass"
owner_agent: "Mirror full-stack developer"
---

# Content href shape has a single source of truth across client and server

## Context

Code review on `feature-agent-parity-architecture` (maintainability reviewer, P1 0.88) flagged that the canonical content URL template lives in two functions:

- **Server:** `packages/convex/convex/chat/toolQueries.ts:41-47`
  ```ts
  export function buildContentHref(
    username: string,
    kind: "articles" | "posts",
    slug: string,
  ): string {
    return `/@${username}/${kind}/${slug}`;
  }
  ```
- **Client:** `apps/mirror/features/content/types.ts:31-38`
  ```ts
  export function getContentHref(
    username: string,
    kind: ContentKind,
    slug?: string,
  ) {
    const basePath = `/@${username}/${kind}`;
    return slug ? `${basePath}/${slug}` : basePath;
  }
  ```

The diff installed cross-reference comments on both functions ("Mirror of buildContentHref … Both must produce the same canonical /@<username>/<kind>/<slug> shape") and two parallel test suites — `tools.test.ts:446-497` and `types.test.ts:43-62` — to keep them in sync.

But the two functions are **already not byte-identical**: the client accepts an optional slug and returns `/@<username>/<kind>` when omitted; the server requires a slug and has no equivalent path. This is a real, structural divergence today — the comment-asserted contract is already violated, and only because the no-slug case isn't tested on the server side. A future template change (e.g. adding a locale prefix) requires four atomic edits: two implementations, two test suites. Comments drift; grep-driven search hits one occurrence at a time.

The agent-parity rule (`.claude/rules/agent-parity.md` § Href-parity invariant) explicitly calls out this failure mode: "A divergence between the two builders silently routes the agent to a 404 while users keep working."

## Goal

The canonical content URL template `/@<username>/<kind>/<slug>` exists in exactly one source location, imported by both the Mirror Next.js app and the Convex backend. A change to the URL shape requires editing one function, not two — and tests on both consumer sides cover the same set of input variations.

## Scope

- Decide between two viable approaches (see Approach below): (A) shared helper exported from `@feel-good/convex` package, OR (B) align the two existing functions structurally and treat them as deliberately mirrored with cross-reference tests.
- If approach A: create `packages/convex/convex/content/href.ts` exporting `buildContentHref(username, kind, slug?)` with both required-slug and optional-slug branches; update both consumers to import it; update `packages/convex/package.json` exports map (per `.claude/rules/identifiers.md` § Adding a new identifier kind, which already documents the dual-export pattern).
- If approach B: align the function signatures (both accept `slug?`), add a test for the slug-omitted path on the server side, and add comment + test infrastructure that surfaces drift the moment one side is edited.
- Update the cross-reference comments in `types.ts` and `toolQueries.ts` to reflect the new arrangement.
- Confirm the agent path (which always passes `slug`) and the user-UI path (which always passes `slug`) both still work end-to-end via the existing e2e.

## Out of Scope

- Changing the URL template itself. The `/@<username>/<kind>/<slug>` shape stays.
- Renaming the function. `buildContentHref` and `getContentHref` can keep their names if approach B is chosen; under approach A the consolidated name is `buildContentHref`.
- Routing changes (the Next.js dynamic route at `app/[username]/<kind>/[slug]/page.tsx` is unaffected).
- Adding a `buildChatAwareHref` equivalent to the server side. The chat-aware suffix (`?chat=1&conversation=`) is intentionally client-only because it depends on `useSearchParams()`.

## Approach

**Approach A (preferred for compounding):** Move the template to a new `packages/convex/convex/content/href.ts`, mirroring the structure `.claude/rules/identifiers.md` already establishes for slug helpers. Both `apps/mirror/features/content/types.ts:31-38` and `packages/convex/convex/chat/toolQueries.ts:41-47` become re-exports or are deleted in favor of the shared import.

`packages/convex/package.json` already has dual `exports` and `typesVersions` surfaces (per identifiers.md); add `./convex/content/href` to both. Then:

```ts
// packages/convex/convex/content/href.ts
export type ContentKind = "articles" | "posts";

export function buildContentHref(
  username: string,
  kind: ContentKind,
  slug?: string,
): string {
  const basePath = `/@${username}/${kind}`;
  return slug ? `${basePath}/${slug}` : basePath;
}
```

Update consumers:
- `packages/convex/convex/chat/toolQueries.ts` — `import { buildContentHref } from "../content/href"` and remove the local definition.
- `apps/mirror/features/content/types.ts` — `export { buildContentHref as getContentHref } from "@feel-good/convex/convex/content/href"` (preserves the legacy name for callers).

**Approach B (lower-effort fallback):** Keep two functions, align their signatures (both accept `slug?`), and treat them as mirror functions explicitly. Add a test on the server side for the slug-omitted case. Less compounding but lower risk if the package-exports plumbing has surprises.

The repo's "Always Choose the Compounding Option" principle (`AGENTS.md` § Core Principles) argues for approach A.

- **Effort:** Medium (approach A) / Small (approach B)
- **Risk:** Low — the function bodies are pure string concatenation; covered by both existing test suites

## Implementation Steps

(For approach A; adjust if B is chosen)

1. Create `packages/convex/convex/content/href.ts` with the consolidated `buildContentHref(username, kind, slug?)` implementation (slug optional).
2. Update `packages/convex/package.json`'s `exports` and `typesVersions` to include `./convex/content/href` (mirror the existing slug entries per `.claude/rules/identifiers.md`).
3. Update `packages/convex/convex/chat/toolQueries.ts:41-47` to import from `../content/href` and delete the local `buildContentHref`.
4. Update `apps/mirror/features/content/types.ts:31-38` to re-export `buildContentHref` (aliased as `getContentHref` for backward compat) from `@feel-good/convex/convex/content/href`.
5. Verify all callers still resolve: `grep -rn 'getContentHref\|buildContentHref' apps/ packages/` and trace each import.
6. Update the cross-reference comments at `types.ts:26-30` and `toolQueries.ts:32-39` — either remove (no longer needed) or simplify to "Re-export from @feel-good/convex/convex/content/href."
7. Update `apps/mirror/features/content/__tests__/types.test.ts` — keep the existing tests but optionally add a server-side equivalent in `tools.test.ts` for the slug-omitted path.
8. Run `pnpm --filter=@feel-good/convex test:unit`, `pnpm --filter=@feel-good/mirror test:unit`, `pnpm build --filter=@feel-good/mirror`, `pnpm lint --filter=@feel-good/mirror`.
9. Run the existing e2e to confirm the agent path still navigates correctly: `pnpm --filter=@feel-good/mirror exec playwright test apps/mirror/e2e/chat-agent-navigates.authenticated.spec.ts`.

## Constraints

- Do not change the URL template format (`/@<username>/<kind>/<slug>`).
- Do not break existing import sites — the `getContentHref` name must remain importable from `@/features/content` for callers in `article-list-item.tsx`, `post-list-item.tsx`, `clone-actions-context.tsx`.
- The Convex `internalQuery` `resolveBySlug` (`toolQueries.ts:131-165`) keeps its current shape — only its internal call to `buildContentHref` changes import source.
- The package exports map is sensitive (per `.claude/rules/identifiers.md`): both `exports` and `typesVersions` must be updated together or TypeScript resolution silently fails at the call site.

## Resources

- `.claude/rules/agent-parity.md` § Href-parity invariant
- `.claude/rules/identifiers.md` § Adding a new identifier kind (canonical template for cross-package helpers)
- `AGENTS.md` § Core Principles ("Always Choose the Compounding Option")
- Code review report from `/review-code` on `feature-agent-parity-architecture` (2026-05-05) — P1 cluster 6
- Existing dual exports for slug helpers: `packages/convex/convex/content/slug.ts` + the same file's `package.json` plumbing
