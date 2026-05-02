---
id: FG_088
title: "Bio delete double-click no longer surfaces a spurious not-found toast"
date: 2026-05-01
type: fix
status: completed
priority: p2
description: "handleDelete in use-bio-panel-handlers.ts has no in-flight guard, and the Delete button in bio-entry-card.tsx has no disabled prop. A double-click (or rapid second tap on mobile) enqueues two removeEntry calls for the same entry._id. The first call's optimistic patch removes the entry and the server deletes the row. The second call's server mutation reads ctx.db.get(args.id) on the now-deleted row, gets null, and throws 'Bio entry not found' (packages/convex/convex/bio/mutations.ts:169-172). That throw surfaces as showToast({type:'error', title:'Bio entry not found'}) — presenting an error toast for an operation that completed successfully. Add an in-flight guard so a second click is a no-op while the first delete is pending."
dependencies: []
parent_plan_id:
acceptance_criteria:
  - "grep -nE 'pendingDeletes|isDeleting|deletingId' apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts returns at least 1 match"
  - "grep -n 'disabled' apps/mirror/features/bio/components/bio-entry-card.tsx returns at least 1 match on the bio-entry-delete button"
  - "Manual: with the network slowed to 1 Mbps, double-click Delete on a bio entry — only one removeEntry network request is fired (verified via DevTools Network panel) and no error toast appears"
  - "pnpm build --filter=@feel-good/mirror succeeds"
  - "pnpm lint --filter=@feel-good/mirror succeeds"
  - "Existing FR-08 deletion E2E in apps/mirror/e2e/bio/bio-tab-owner-crud.authenticated.spec.ts continues to pass"
owner_agent: "Frontend React refactor specialist"
---

# Bio delete double-click no longer surfaces a spurious not-found toast

## Context

Code review of the bio optimistic-updates branch flagged a concurrency bug in the delete path. The handler at `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts:41-50`:

```ts
const handleDelete = useCallback(
  async (entry: BioEntry) => {
    try {
      await removeEntry({ id: entry._id });
    } catch (err) {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
    }
  },
  [removeEntry],
);
```

The Delete button in `apps/mirror/features/bio/components/bio-entry-card.tsx:55-62` has no `disabled` prop:

```tsx
<Button
  size="sm"
  variant="ghost"
  onClick={() => onDelete(entry)}
  data-testid="bio-entry-delete"
>
  Delete
</Button>
```

A double-click (trivially producible on touchpad/touchscreen) enqueues two `removeEntry({ id: entry._id })` calls before either resolves. Behavior trace:

1. **Click 1:** Optimistic patch removes the row from the panel's `getByUsername` query (`use-bio-entries.ts:140-154`). Server mutation runs, `ctx.db.get(args.id)` returns the row, deletes it, ok.
2. **Click 2:** Optimistic patch runs `current.filter(e => e._id !== args.id)` on the already-absent entry — no-op on the store. Server mutation runs, `ctx.db.get(args.id)` returns `null` because the row was deleted in step 1, then `if (!entry) throw new Error("Bio entry not found")` fires (`packages/convex/convex/bio/mutations.ts:169-172`).
3. The throw propagates to the catch at line 46 of `use-bio-panel-handlers.ts`, which calls `showToast({ type: "error", title: "Bio entry not found" })` — for an operation the user perceives as successful.

The list state ends correct (the row is gone), but the user sees a confusing error toast. Confidence on the diagnosis: 0.92 (concurrency reviewer).

Note: the same `Bio entry not found` throw also exists in the `update` mutation at `mutations.ts:116-118`. The same race shape (rapid edit → re-edit a now-missing row) is theoretically possible but harder to trigger because the edit flow goes through the dialog. Out of scope for this ticket — see Out of Scope below.

## Goal

A user who double-clicks Delete on a bio entry sees the row disappear once and no error toast. Only one `removeEntry` network request is dispatched per logical user intent. The existing FR-08 E2E (single-delete + persistence) continues to pass without modification.

## Scope

- Add an in-flight tracking mechanism in `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts` so a second `handleDelete(entry)` call for an entry already pending is a no-op.
- Surface the in-flight set (or per-row boolean) to `BioPanel`/`BioEntryList`/`BioEntryCard` so the Delete button reads `disabled={pending}` for the in-flight row.
- Update `bio-entry-card.tsx` to accept and apply a `disabled` prop on the Delete button.

## Out of Scope

- Adding the same guard to the Edit flow — the dialog gate prevents the double-edit race in practice, and the Edit submit path already closes the dialog synchronously.
- Adding a disabled state to the Edit button — same reason.
- Changing the server mutation's "not found" throw — that's still the correct trust-boundary behavior for stale-tab / cross-user attempts.
- Adding a confirmation dialog for delete (a separate UX decision).
- E2E coverage for the double-click race (the manual verification step covers it; an automated double-click test against optimistic UI is flaky).
- Refactoring `handleDelete` into the optimistic-update callback inside `use-bio-entries.ts` — keep it in the panel-handlers hook where the toast surface lives.

## Approach

Two viable shapes:

**Shape A (preferred — Set of pending IDs):** In `use-bio-panel-handlers.ts`, introduce a ref-backed `Set<Id<"bioEntries">>` of in-flight delete IDs. Guard `handleDelete` with `if (pendingRef.current.has(entry._id)) return;`, add the ID before the await, remove in `finally`. Expose `pendingDeletes: ReadonlyArray<string>` (or `isDeleting(id)` predicate) in the return value. `BioEntryList` reads it and threads `disabled` into each `BioEntryCard`. Use a ref so the Set itself doesn't need re-renders to update; pair with `useState` + `useCallback`-bumped commit if a per-row disabled prop needs to re-render the card. The cleaner form: store the Set in state so each add/remove triggers a re-render of the list with the correct `disabled` per row.

**Shape B (lighter — per-row state in BioEntryCard):** Move the in-flight tracking entirely into `BioEntryCard`: local `useState(false)` for `isDeleting`, set true before calling `onDelete(entry)`, reset to false on unmount or on entry-prop change. Simpler but loses the central view of in-flight deletes (FG_089's toast-error E2E is easier to write with the central view, though not dependent on it).

Default: **Shape A**. The hook is already the single source of truth for mutation flow; tracking pending IDs there keeps the data-flow consistent with the rest of the file.

- **Effort:** Small
- **Risk:** Low — additive change. Failure mode is "the disabled state lingers if `finally` doesn't fire," which can't happen unless the mutation neither resolves nor rejects (Convex guarantees one or the other).

## Implementation Steps

1. Edit `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts`:
   - Add `const [pendingDeletes, setPendingDeletes] = useState<ReadonlySet<Id<"bioEntries">>>(new Set());` (import `Id` from `@feel-good/convex/convex/_generated/dataModel`).
   - Modify `handleDelete` to early-return if `pendingDeletes.has(entry._id)`. Wrap the body so `setPendingDeletes(prev => new Set(prev).add(entry._id))` runs before the await and `setPendingDeletes(prev => { const next = new Set(prev); next.delete(entry._id); return next; })` runs in `finally`.
   - Add `pendingDeletes` to the hook's return shape.
2. Edit `apps/mirror/features/bio/components/bio-panel.tsx`: destructure `pendingDeletes` and thread it into `<BioEntryList ... pendingDeletes={pendingDeletes} />`.
3. Edit `apps/mirror/features/bio/components/bio-entry-list.tsx`: accept `pendingDeletes: ReadonlySet<Id<"bioEntries">>`, pass `isDeleting={pendingDeletes.has(entry._id)}` to each `<BioEntryCard>`.
4. Edit `apps/mirror/features/bio/components/bio-entry-card.tsx`: accept `isDeleting?: boolean` prop, set `<Button disabled={isDeleting} ... data-testid="bio-entry-delete">` (the Edit button stays unchanged per Out of Scope).
5. Run `pnpm build --filter=@feel-good/mirror` and `pnpm lint --filter=@feel-good/mirror`.
6. Manual verification: throttle DevTools Network to "Slow 3G", double-click Delete on an entry, confirm one network request and no error toast.
7. Run the FR-08 E2E (`pnpm --filter=@feel-good/mirror test:e2e -- bio/bio-tab-owner-crud`) — single-delete coverage must still pass without modification.

## Constraints

- The disabled state must be tied to the specific entry ID — disabling all delete buttons globally during one delete is a regression in the multi-row case.
- Setter calls must not race with mutation completion; use the functional `setPendingDeletes(prev => ...)` form to avoid stale-state reads.
- Do not change `removeEntry`'s `withOptimisticUpdate` callback — the optimistic patch already handles re-deletion as a no-op correctly; the issue is purely the post-server-rejection toast.
- The `Id<"bioEntries">` import must use the inline-type form (`import { type Id } from "..."`) per `.claude/rules/typescript.md`.

## Manual Verification

Per `.claude/rules/verification.md` Tier 4: build + lint + Chrome MCP interaction. The double-click race is the verification — without DevTools throttling it can be hard to land both clicks before the first resolves; with "Slow 3G" the race window opens to ~1s and the bug reproduces reliably pre-fix.

## Resources

- Code review report (this branch) — Finding #3, P2 Moderate, concurrency reviewer.
- `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts:41-50` — the unguarded handler.
- `apps/mirror/features/bio/components/bio-entry-card.tsx:55-62` — the unguarded button.
- `packages/convex/convex/bio/mutations.ts:169-172` — the server-side throw whose toast this prevents.
- `.claude/rules/optimistic-updates.md` § Submit-flow UX — context on the toast-as-error-surface invariant.
