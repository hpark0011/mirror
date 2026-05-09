---
id: FG_170
title: "Mutation error toast helper scrubs internal strings and is feature-agnostic"
date: 2026-05-09
type: improvement
status: to-do
priority: p2
description: "Mirror has a single helper getMutationErrorMessage at apps/mirror/features/bio/utils/mutation-helpers.ts:38 that maps thrown errors to toast titles, but it forwards err.message verbatim — including internal status strings like 'Not authenticated' (lib/auth.ts:17) and 'App user not found' (users/helpers.ts) — so a session expiry or auth-race surfaces those raw labels to the user. It also lives under features/bio/ but is consumed by posts and articles, which cross feature boundaries via ../../bio/utils/mutation-helpers. And several hooks (use-publish-toggle.ts, content-editor.tsx) still hand-roll the err instanceof Error ? err.message : '…' shape and don't go through the helper at all. Harden the helper with a deny-list of known internal-only strings (or a positive whitelist of user-friendly shapes), relocate it to a feature-agnostic path, and adopt it on the remaining hold-out callers."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -nE \"err instanceof Error \\? err.message\" apps/mirror/features apps/mirror/hooks --include='*.ts' --include='*.tsx' -r returns zero matches outside the helper file (callers all go through the helper)"
  - "test -f apps/mirror/lib/get-mutation-error-message.ts OR test -f apps/mirror/features/content/lib/get-mutation-error-message.ts (helper relocated out of features/bio/)"
  - "grep -n \"Not authenticated\\|App user not found\\|Unauthenticated\" apps/mirror/lib/get-mutation-error-message.ts apps/mirror/features/content/lib/get-mutation-error-message.ts 2>/dev/null returns at least 1 match (deny-list literal present)"
  - "test -f apps/mirror/lib/__tests__/get-mutation-error-message.test.ts OR equivalent — covers (a) ConvexError-shaped 'Bio entry limit reached (50)' passes through, (b) 'Not authenticated' is replaced with the generic fallback, (c) non-Error throw uses the generic fallback"
  - "pnpm --filter=@feel-good/mirror test:unit -- get-mutation-error-message passes"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
owner_agent: "Senior Mirror frontend engineer"
---

# Mutation error toast helper scrubs internal strings and is feature-agnostic

## Context

Surfaced by code review of `feature-post-delete-button` (PR #68) as a pre-existing P3 finding (`error-message-leaks-internal-status`, conf 0.60), then re-confirmed by a CodeRabbit review comment on `use-delete-post.ts:44-52`. The concern is real but not unique to this PR — it spans the codebase.

State of the helper today:

```ts
// apps/mirror/features/bio/utils/mutation-helpers.ts:38-42
export function getMutationErrorMessage(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "Something went wrong. Please try again.";
}
```

The helper performs only `Error` narrowing. ConvexError `.message` is preserved verbatim by design — that's correct for legitimate user-facing strings like `"Bio entry limit reached (50). Delete an entry to add another."` (`packages/convex/convex/bio/limits.ts`). But it also forwards strings the user should never see:

- `"Not authenticated"` — `packages/convex/convex/lib/auth.ts:17` (auth guard fires when the JWT expires mid-request)
- `"App user not found"` — `packages/convex/convex/users/helpers.ts` (database row missing for the auth identity)
- `"Unauthenticated"` — Better Auth + `convexAuth` adapter

These appear as toast titles when the corresponding Convex mutation rejects. Failure mode is rare (session expires while a dialog is open) but unambiguous when it fires.

Three callers go through the helper today:

- `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts:74,105`
- `apps/mirror/features/posts/hooks/use-delete-post.ts:68` (added in commit `7b728a79`)
- `apps/mirror/features/articles/hooks/use-edit-article-form.tsx:204,238,251`
- `apps/mirror/features/articles/hooks/use-new-article-form.tsx:179,213,222`

Holdouts that still hand-roll `err instanceof Error ? err.message : "…"`:

- `apps/mirror/features/posts/hooks/use-publish-toggle.ts:51`
- `apps/mirror/features/content/components/content-editor.tsx:111` (the save-fallback path; the `InlineImageValidationError` branch at `:97` is intentionally separate and should stay)
- `apps/mirror/features/chat/hooks/use-chat-send.ts:39,64` — has its own classifier with rate-limit code awareness; should keep that classifier but route the unrecognized branch through the new helper
- `apps/mirror/features/video-call/components/cvi/conversation.tsx:45` — Tavus-side error, not a Convex mutation; OUT of scope

The helper also lives at `features/bio/utils/mutation-helpers.ts` and is imported by posts + articles via `../../bio/utils/mutation-helpers`. That cross-feature import is a smell — the helper is not bio-specific.

## Goal

After this ticket: every Convex-mutation toast in `apps/mirror/` flows through one helper that (a) maps a small known-internal-string deny-list to the generic `"Something went wrong. Please try again."` fallback, (b) preserves user-facing ConvexError messages verbatim, (c) lives at a feature-agnostic location. A future `Not authenticated` rejection surfaces the friendly fallback, while `Bio entry limit reached (50). …` continues to surface the rich message.

## Scope

- Move the helper out of `features/bio/utils/` to a feature-agnostic location (recommend `apps/mirror/lib/get-mutation-error-message.ts` to mirror existing `lib/` shape, or `features/content/lib/` if the team prefers a per-feature org).
- Add a deny-list of known internal-only strings — at minimum: `"Not authenticated"`, `"Unauthenticated"`, `"App user not found"`. When `err.message` matches a deny-list literal exactly, return the generic fallback instead.
- Update all current importers to the new path (no behavior change for them — they were already using the helper).
- Adopt the helper on `use-publish-toggle.ts:51` and `content-editor.tsx:111`.
- For `use-chat-send.ts`: keep the rate-limit classifier; route the final fallback at `:39` and `:64` through the helper.
- Add a unit test next to the helper covering the deny-list, the pass-through path, and the non-Error throw.

## Out of Scope

- Re-localizing toast strings via `react-i18next` — Mirror does not currently use react-i18next anywhere; that's a separate adoption decision.
- Changing the underlying Convex error classes or replacing the auth guard's `Error("Not authenticated")` with a typed exception. The deny-list is a UX patch, not a server-side refactor.
- Logging the original error to Sentry/console for debugging. The current call sites already swallow the original; if the team wants visibility, that's a separate ticket (likely depends on `@feel-good/sentry-config`).
- The Tavus error path at `conversation.tsx:45` — non-Convex, different failure mode.
- Centralizing the `InlineImageValidationError` branch at `content-editor.tsx:97` — that's a typed validation error with a known-friendly message; keep it.

## Approach

Single helper file with a deny-list constant + the same `Error`-narrowing surface. The deny-list is opt-in literal-match — no regex parsing, no fancy heuristics. If the helper grows third-party error class awareness later (e.g., Tavus errors), do that as an additive PR.

```ts
// apps/mirror/lib/get-mutation-error-message.ts
const INTERNAL_ONLY_MESSAGES = new Set([
  "Not authenticated",
  "Unauthenticated",
  "App user not found",
]);

const GENERIC_FALLBACK = "Something went wrong. Please try again.";

export function getMutationErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return GENERIC_FALLBACK;
  if (INTERNAL_ONLY_MESSAGES.has(err.message)) return GENERIC_FALLBACK;
  return err.message;
}
```

The deny-list shape (Set of literal strings) is intentionally simple — every entry has a clear server-side origin and adding/removing an entry is a one-line review. Resist the temptation to use a regex; the false-positive cost is much higher than the false-negative cost.

- **Effort:** Small
- **Risk:** Low — pure refactor, behavior change is limited to three known strings being replaced with a generic fallback (a UX improvement, not a regression for any current flow).

## Implementation Steps

1. Create `apps/mirror/lib/get-mutation-error-message.ts` with the helper, the `INTERNAL_ONLY_MESSAGES` deny-list, and the `GENERIC_FALLBACK` constant.
2. Create `apps/mirror/lib/__tests__/get-mutation-error-message.test.ts` with three tests: (a) `new Error("Bio entry limit reached (50). …")` returns the verbatim message; (b) `new Error("Not authenticated")` returns `GENERIC_FALLBACK`; (c) `"oops"` (non-Error throw) returns `GENERIC_FALLBACK`.
3. Update all current importers from `../../bio/utils/mutation-helpers` to `@/lib/get-mutation-error-message` (or relative path equivalent): `use-bio-panel-handlers.ts`, `use-delete-post.ts`, `use-edit-article-form.tsx`, `use-new-article-form.tsx`. Same import name (`getMutationErrorMessage`).
4. Update `apps/mirror/features/bio/utils/mutation-helpers.ts`: keep the file (it still exports `toMutationArgs` for the bio form), delete the now-relocated `getMutationErrorMessage` export.
5. Adopt on `use-publish-toggle.ts:51` — replace the inline `err instanceof Error ? err.message : "…"` with `getMutationErrorMessage(err)`.
6. Adopt on `content-editor.tsx:111` — same replacement; leave the `InlineImageValidationError` branch at `:97` untouched.
7. Adopt on `use-chat-send.ts:39` and `:64` — keep the existing rate-limit classifier; replace only the final `err instanceof Error ? err.message : "…"` fallback with `getMutationErrorMessage(err)`.
8. Update the helper's docstring to describe the deny-list rationale and link to the ticket / PR.
9. Run `pnpm --filter=@feel-good/mirror test:unit`, `pnpm build --filter=@feel-good/mirror`, `pnpm lint --filter=@feel-good/mirror`.

## Constraints

- Keep the helper feature-agnostic — do not re-import it from `features/<x>/`. Path lives under `apps/mirror/lib/` (or `features/content/lib/` if the team prefers).
- Do not add Sentry/console logging in this ticket — see Out of Scope.
- Do not adopt the helper for the Tavus path at `conversation.tsx:45` — non-Convex, different failure shape.
- Do not change the surface of `getMutationErrorMessage` (still `(err: unknown) => string`). All current callers must compile unchanged after the import-path swap.
- The deny-list strings must match the Convex thrown messages **exactly**. If the server changes any of them, update the deny-list in the same PR.

## Resources

- Code review report (this branch) — pre-existing finding `error-message-leaks-internal-status` (P3, conf 0.60).
- PR #68 CodeRabbit comment on `use-delete-post.ts:44-52` — restating the same concern.
- `apps/mirror/features/bio/utils/mutation-helpers.ts:38-42` — current helper.
- `packages/convex/convex/lib/auth.ts:17` — origin of `"Not authenticated"`.
- `packages/convex/convex/users/helpers.ts` — origin of `"App user not found"`.
- `apps/mirror/features/chat/hooks/use-chat-send.ts:38-65` — example of a feature-specific classifier that should remain (rate-limit codes) while delegating the unknown branch to the new helper.
