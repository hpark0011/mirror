---
id: FG_087
title: "Bio entry dialog stays interactive on rapid re-open after submit"
date: 2026-05-01
type: fix
status: completed
priority: p2
description: "After the synchronous-close refactor, BioEntryFormDialog's local isSubmitting useState is vestigial. Submit flow now: setIsSubmitting(true) → onSubmit() synchronously closes the dialog (setDialog({open:false})) → dialog re-renders with open=false → mutation awaits → finally setIsSubmitting(false). The dialog component stays mounted (mount is gated by isOwner, not dialog.open) and the inner form key is stable across consecutive create opens (key='new'), so isSubmitting persists across the close. If the user clicks Add again before the prior mutation settles, BioEntryFormDialog re-renders with open=true while isSubmitting is still true, leaving the submit button disabled and showing 'Saving...' until the prior mutation resolves. Remove the now-vestigial isSubmitting state — the dialog closes before the await, so it no longer guards anything in the happy path."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -n 'isSubmitting' apps/mirror/features/bio/components/bio-entry-form-dialog.tsx returns 0 matches"
  - "grep -n 'useState' apps/mirror/features/bio/components/bio-entry-form-dialog.tsx returns 0 matches (the only useState was for isSubmitting)"
  - "BioEntryForm in apps/mirror/features/bio/components/bio-entry-form.tsx still receives an isSubmitting boolean prop OR the prop is removed at both call sites and the form's submit-button disabled prop is sourced elsewhere — pick one and apply consistently"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
  - "Manual: open the bio dialog, submit a valid entry (dialog closes), immediately click Add again — the dialog opens with an interactive submit button (no 'Saving...' label, no disabled state) within one frame"
owner_agent: "Frontend React refactor specialist"
---

# Bio entry dialog stays interactive on rapid re-open after submit

## Context

The bio optimistic-updates refactor (commits `e16a3f35`, `789b90c4`) moved the dialog close from "after the await resolves" to "synchronously, before the await". The handler at `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts:52-73` now reads:

```ts
const handleSubmit = useCallback(
  async (values) => {
    const args = toMutationArgs(values);
    const editId =
      dialog.open && dialog.mode === "edit" ? dialog.entry._id : null;
    setDialog({ open: false });          // synchronous close — happens FIRST
    try {
      if (editId !== null) await updateEntry({ id: editId, ...args });
      else await createEntry(args);
    } catch (err) {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
    }
  },
  [createEntry, updateEntry, dialog],
);
```

But `BioEntryFormDialog` (`apps/mirror/features/bio/components/bio-entry-form-dialog.tsx:47-56`) still owns a local `isSubmitting` boolean from before the refactor:

```tsx
const [isSubmitting, setIsSubmitting] = useState(false);

async function handleSubmit(values) {
  setIsSubmitting(true);
  try {
    await onSubmit(values);
  } finally {
    setIsSubmitting(false);
  }
}
```

The dialog component is mounted under `{isOwner ? <BioEntryFormDialog ... /> : null}` (`bio-panel.tsx:64-76`) — gated by `isOwner`, not by `dialog.open`. The inner form's `key={entry?._id ?? "new"}` (`bio-entry-form-dialog.tsx:75`) is stable across two consecutive create opens. So between submit and mutation-settle, `isSubmitting` is `true` while the dialog is closed; if the user re-opens the dialog (Add button click) inside that window, the same component instance re-renders with `open=true` and `isSubmitting=true`, leaving the submit button (`<Button type="submit" disabled={isSubmitting}>` in `bio-entry-form.tsx:64`) disabled and the label flipped to "Saving..." until the prior mutation's `finally` fires.

Confidence on the diagnosis: 0.98 (cross-reviewer agreement from correctness and concurrency reviewers in the branch's code review report).

`isSubmitting` was load-bearing in the pre-refactor flow (the dialog stayed open during the await, so disabling submit prevented duplicate submissions of the same form). Post-refactor, the dialog is gone before the await runs and the optimistic patch already reflects the user's input — the state machine no longer has a job. Removing it is the simplest fix and aligns with `.claude/rules/optimistic-updates.md` § Submit-flow UX ("the submit affordance can also resolve synchronously").

## Goal

`BioEntryFormDialog` no longer owns `isSubmitting` state. After a user submits the bio dialog, the dialog closes synchronously, and clicking Add again immediately re-opens the dialog with a fully interactive submit button — independent of whether the prior mutation has settled. No regression in the happy path (single submit → close → optimistic list update → server confirms).

## Scope

- Delete `useState(false)` / `setIsSubmitting` / `isSubmitting` from `apps/mirror/features/bio/components/bio-entry-form-dialog.tsx`.
- Inline the `handleSubmit` wrapper or pass `props.onSubmit` directly to `BioEntryForm` — the wrapper's only job was setting/clearing `isSubmitting`.
- Update `BioEntryForm` (`apps/mirror/features/bio/components/bio-entry-form.tsx`) to either drop the `isSubmitting` prop entirely, OR keep the prop and let RHF's own `formState.isSubmitting` drive the submit-button disabled state — pick one.

## Out of Scope

- Changing the optimistic-update behavior in `use-bio-entries.ts`.
- Removing the `try/catch` + toast in `use-bio-panel-handlers.ts:handleSubmit` — server rejections still need to surface.
- Adding new tests for this fix beyond the manual-verification round trip; FG_088 (delete in-flight guard) and FG_089 (toast error E2E) cover adjacent test gaps.
- Touching the dialog mount strategy (`{isOwner ? ... : null}`). Conditionally mounting on `dialog.open` would also fix the bug but introduces a different set of trade-offs (RHF state churn, focus-management edge cases) and is not required.

## Approach

Pick the minimal-edit shape: remove the wrapper function and pass `props.onSubmit` straight through. RHF's `form.formState.isSubmitting` is automatically true while its internal `handleSubmit` await is in flight; if the submit-button needs a "submitting" affordance for the post-synchronous-close window (it doesn't, because the dialog is gone), `BioEntryForm` can read `formState.isSubmitting` directly without a parent-passed prop.

Two equally clean shapes:

**Shape A (preferred — lighter):** Remove `isSubmitting` from `BioEntryFormDialog`, remove the `isSubmitting` prop from `BioEntryForm`, drop any `disabled={isSubmitting}` on the form's submit button. Justification: the dialog closes synchronously, so the user never sees a "Saving..." state in the happy path. RHF's own `formState.isSubmitting` is also briefly true but the submit-button is unmounted with the dialog before it can render.

**Shape B (preserve the prop):** Drop `useState` from `BioEntryFormDialog` but pass `form.formState.isSubmitting` from inside `BioEntryForm` to the local submit button. Slightly more code but keeps the form self-contained for any future unit-test that re-uses `BioEntryForm` outside a dialog.

- **Effort:** Small
- **Risk:** Low — deletion-and-rewire of one component-local state. Failure mode is "the submit button is briefly clickable during a sub-second optimistic close window," which is harmless because the form is unmounted within the same React batch.

## Implementation Steps

1. Read `apps/mirror/features/bio/components/bio-entry-form.tsx` to confirm where `isSubmitting` flows (props arrival, submit-button disabled binding, "Saving..." label if any).
2. Pick Shape A or B. Default to Shape A (drop the prop entirely) unless the form needs the prop for a reason that surfaces during step 1.
3. Edit `apps/mirror/features/bio/components/bio-entry-form-dialog.tsx`:
   - Remove `import { useState } from "react";` if it becomes unused.
   - Remove the `useState(false)` line and the `handleSubmit` async wrapper.
   - Replace `<BioEntryForm ... onSubmit={handleSubmit} ... />` with `<BioEntryForm ... onSubmit={onSubmit} ... />`.
   - Drop the `isSubmitting={isSubmitting}` prop from `<BioEntryForm>` if Shape A.
4. Edit `apps/mirror/features/bio/components/bio-entry-form.tsx`:
   - If Shape A: remove `isSubmitting` from props type, the destructure, and any `disabled={isSubmitting}` binding (replace with `disabled={form.formState.isSubmitting}` if the dialog ever stays open in some future variant — otherwise drop entirely).
   - If Shape B: keep the prop and pass it through normally; no further change needed.
5. Run `pnpm build --filter=@feel-good/mirror` — fixes any prop-type drift.
6. Run `pnpm lint --filter=@feel-good/mirror` — catches unused imports.
7. Manual round-trip via Chrome MCP at `http://localhost:3001/@<owner>/bio`: submit a valid create → confirm dialog closes immediately → click Add again within the next 200ms → confirm the submit button is interactive (not disabled, no "Saving...") immediately.

## Constraints

- Do not change `use-bio-panel-handlers.ts` — the synchronous-close shape is correct and codified in the rule file.
- Do not introduce a new ref or `useEffect` to "reset on open=true" — that path was rejected during review as more code than the deletion fix.
- The `try/catch` + toast at `use-bio-panel-handlers.ts:62-70` must remain unchanged — it's the only error surface after dialog close.
- No change to the `BioEntryForm` Zod schema or RHF resolver wiring.

## Manual Verification

Per `.claude/rules/verification.md` Tier 4 (event handlers / user interactions): build + lint + Chrome MCP. Run `pnpm dev`, navigate to a profile owned by the signed-in test user with at least 1 bio entry, click Edit on an entry, change a field, click Save, immediately click Edit on another entry. Confirm the second dialog opens with an interactive Save button (not disabled, not labeled "Saving..."). Repeat with the Add flow.

## Resources

- Code review report (this branch) — Finding #2, P2 Moderate, merged correctness + concurrency.
- `apps/mirror/features/bio/components/bio-entry-form-dialog.tsx:47-56` — the vestigial state.
- `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts:52-73` — the synchronous-close handler this depends on.
- `.claude/rules/optimistic-updates.md` § Submit-flow UX — codifies the pattern this fix completes.
