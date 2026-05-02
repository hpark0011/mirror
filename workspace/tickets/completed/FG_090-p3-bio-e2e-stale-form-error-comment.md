---
id: FG_090
title: "Bio E2E test comment reflects synchronous-close mechanism"
date: 2026-05-01
type: docs
status: completed
priority: p3
description: "The comment at apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts:310 reads 'Dialog closes after a successful save (handler clears formError + sets open=false).' The formError state was deleted in the optimistic-updates refactor — the handler now closes the dialog synchronously before awaiting the mutation, not by clearing a form-error state. The behavioral assertion (await expect(dialog).not.toBeVisible) is still valid, but the comment misrepresents the mechanism and will misdirect future readers searching for formError in the hook."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -n 'formError' apps/mirror/e2e/bio/ returns 0 matches"
  - "grep -n 'synchronously' apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts returns at least 1 match describing the dialog-close mechanism near the existing FR-06 test"
  - "Existing FR-06 edit test continues to pass: pnpm --filter=@feel-good/mirror test:e2e -- bio/bio-tab-owner-crud -g 'FR-06' is green"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
owner_agent: "General code-cleanup specialist"
---

# Bio E2E test comment reflects synchronous-close mechanism

## Context

The comment at `apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts:310` reads:

```ts
// Dialog closes after a successful save (handler clears formError + sets open=false).
await expect(dialog).not.toBeVisible({ timeout: 5_000 });
```

The `formError` state was removed from `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts` in commit `789b90c4` (refactor(bio): close dialog synchronously, errors via toast). The handler now closes the dialog synchronously BEFORE awaiting the mutation:

```ts
// use-bio-panel-handlers.ts:60 (post-refactor)
setDialog({ open: false });
try {
  if (editId !== null) await updateEntry({ id: editId, ...args });
  else await createEntry(args);
} catch (err) {
  showToast({ type: "error", title: getMutationErrorMessage(err) });
}
```

The assertion is still correct — the dialog does close after a successful save. But the comment's mechanism description is wrong: there is no `formError` to clear, and the close happens before the await rather than after. A future engineer reading the comment will look for `formError` in the hook, find nothing, and waste time reconciling the test against a state machine that no longer exists.

Per `AGENTS.md` core principle: "When a bug or feedback reveals a gap in a skill, rule, convention, or template, patch the upstream artifact before (or alongside) fixing the downstream instance." The upstream rule (`.claude/rules/optimistic-updates.md` § Submit-flow UX) already documents the new mechanism; this ticket aligns the downstream test comment with that documentation.

## Goal

The comment in `bio-tab-owner-crud.authenticated.spec.ts:310` accurately describes the synchronous-close mechanism — no reference to `formError`. The test's assertion is unchanged; only the comment text changes.

## Scope

- Replace the comment at `apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts:310` with a description of the synchronous-close mechanism.
- Optionally remove the comment entirely if the assertion below it is self-explanatory.

## Out of Scope

- Any changes under `apps/mirror/features/bio/` — the test code is already correct.
- Updating `.claude/rules/optimistic-updates.md` — already documents the synchronous-close mechanism.
- Adding new tests or fixing other coverage gaps — see FG_086 / FG_089 for those.
- Other stale comments in the codebase — handle in a separate sweep if desired.

## Approach

Two acceptable shapes — pick one:

**Shape A (informative):** Replace with: `// Dialog closes synchronously on submit (handler calls setDialog({ open: false }) before awaiting the mutation).`

**Shape B (deletion):** Remove the comment entirely. The next-line assertion (`await expect(dialog).not.toBeVisible(...)`) is sufficient on its own and the test name above it ("FR-06: edit flow updates the card and persists") makes the intent clear.

Default: **Shape B** — per repo guidance to default to no comments unless the WHY is non-obvious. The "dialog closes after save" expectation is obvious from the test name and the assertion.

- **Effort:** Trivial
- **Risk:** Low — comment-only change.

## Implementation Steps

1. Open `apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts` and locate line 310.
2. Apply Shape A or Shape B (default Shape B). If Shape A: replace the comment text. If Shape B: delete the comment line entirely.
3. Run `pnpm lint --filter=@feel-good/mirror` to confirm no formatting regression.
4. Optionally run `pnpm --filter=@feel-good/mirror test:e2e -- bio/bio-tab-owner-crud -g "FR-06"` to confirm the test still parses and passes.

## Constraints

- No code changes — comment-only edit.
- Do not introduce a multi-line comment block in place of the single-line edit (per repo guidance, comments stay short).

## Resources

- Code review report (this branch) — Finding #5, P3 Low, merged convention + tests reviewers.
- `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts:60` — the synchronous-close call this comment misrepresents.
- `.claude/rules/optimistic-updates.md` § Submit-flow UX — the canonical description of the mechanism.
- Commit `789b90c4` — the refactor that removed `formError`.
