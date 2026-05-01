---
paths:
  - "apps/**/features/**/hooks/*.ts"
  - "apps/**/features/**/hooks/*.tsx"
  - "apps/**/features/**/components/*.tsx"
  - "packages/features/**/hooks/*.ts"
---

# Optimistic Updates

CRUD that mutates a Convex query the same screen reads MUST wire
`withOptimisticUpdate` so the list reflects the change before the server
round-trip resolves. Bare `useMutation(...)` is reserved for fire-and-forget
mutations whose result the current screen does not display.

## When to use which pattern

| Shape                                                 | Pattern                                                  |
| ----------------------------------------------------- | -------------------------------------------------------- |
| List query + create/update/delete on its rows         | Convex `withOptimisticUpdate` (this file)                |
| Single-doc query + patch mutation                     | Convex `withOptimisticUpdate` — see `apps/mirror/features/profile/components/profile-info.tsx:61-77` |
| Streaming/agent state with custom merge logic         | React-state optimistic layer — see `apps/mirror/features/chat/hooks/use-chat-optimistic.ts` |
| Mutation whose result is invisible on the current view | Bare `useMutation(...)` — no optimism needed            |

## List-CRUD recipe

Reference: `apps/mirror/features/bio/hooks/use-bio-entries.ts`.

1. **Define a `sortAndCap<T>` helper that mirrors the server query's
   ordering and any `.slice(N)` cap.** Live next to the hook; do not import
   server constants.
2. **Wrap each `useMutation(...)` in `useMemo`** keyed on the query's args
   (e.g. `[mutation, username]`). Without `useMemo` the wrapped mutation
   re-allocates every render and breaks downstream `useCallback` deps.
3. **Always guard `if (current == null) return;`.** Convex queries can
   return `null` (e.g. when a username doesn't resolve); the mutation will
   reject server-side anyway.
4. **Derive the element type with `(typeof current)[number]`.** Do NOT
   type optimistic entries as `Doc<"tableName">` — its optional-key shape
   (`description?: string`) does not match the strict shape Convex's
   `setQuery` expects (`description: string | undefined`).
5. **Pass `Array<T>` to `setQuery`** (mutable). `ReadonlyArray<T>` from a
   helper return type will fail the call.
6. **For optimistic creates:**
   - `_id`: `crypto.randomUUID() as Id<"tableName">`. Lint allows this;
     `Date.now()` is rejected by `react-hooks/purity`.
   - `_creationTime`: **`Number.MAX_SAFE_INTEGER`**, not `Date.now()`.
     `_creationTime` is a sort tiebreaker only; MAX_SAFE_INTEGER pins the
     optimistic row to the top of any tie until the real value arrives,
     and avoids the `react-hooks/purity` lint rejection.
   - Server-derived fields the UI never reads (e.g. `userId`): borrow from
     `current[0]?.userId` and fall back to a placeholder cast like
     `("__optimistic__" as Id<"users">)`. Verify the field is unused by
     greping the feature's components first.
7. **For optimistic updates:** mirror the server's partial-patch
   semantics — `{...entry, ...(args.X !== undefined && { X: args.X })}`.
   Re-run `sortAndCap` afterwards in case a sort key changed.
8. **For optimistic deletes:** `current.filter((e) => e._id !== args.id)`.
   No `sortAndCap` needed.
9. **Soft caps (e.g. 50-entry limits) stay server-side.** Let the
   optimistic insert briefly exceed the cap; Convex auto-rolls-back when
   the mutation throws and the toast surfaces the message.

## Submit-flow UX

The point of optimism isn't just "list updates fast" — it's that the
submit affordance can also resolve synchronously.

- **Close the dialog/sheet/inline-editor synchronously on submit.** Do
  NOT `await` the mutation before calling `setOpen(false)`. The list is
  already optimistic; the user has nothing to wait for.
- **Capture any state you need from the dialog (e.g. `editId`) into a
  local variable BEFORE you call `setOpen(false)`** — once the close
  fires, subsequent renders will see `dialog.open === false` and the
  in-flight `await` may otherwise read stale closure state.
- **Errors surface via toast, not inline.** With the dialog gone, an
  inline `formError` slot is unreachable. Server-side rejections (rare
  when client-side Zod validation is thorough) flow through `try/catch`
  → `showToast({ type: "error", title: getMutationErrorMessage(err) })`.
- **Trust client validation.** `react-hook-form` + `zodResolver` blocks
  invalid submits before our handler runs, so server errors are limited
  to soft caps and authorization edge cases — both fine for a toast.

Reference: `apps/mirror/features/bio/hooks/use-bio-panel-handlers.ts`
(the `handleSubmit` path closes the dialog before awaiting the
mutation).

## Footguns

- **`Date.now()` inside a `useMemo`→`withOptimisticUpdate` callback is
  rejected by `react-hooks/purity`** even though the callback only runs at
  mutation-fire time. `useCallback`-wrapped uses (e.g.
  `apps/mirror/features/chat/hooks/use-chat-optimistic.ts:202`) are NOT
  flagged. Use `Number.MAX_SAFE_INTEGER` per the recipe; reach for an
  `eslint-disable` comment only if you genuinely need wall-clock time.
- **Don't construct optimistic entries as `Doc<"tableName">`.** Its
  optional-key shape silently breaks the `setQuery` element-type contract.
  Use `(typeof current)[number]`.
- **Don't manage rollback by hand.** Convex auto-rolls-back the optimistic
  patch when the mutation rejects; existing `try/catch` in the call site
  handles the user-facing error message.
- **Don't extend the server preload contract.** `withOptimisticUpdate`
  patches the same `getByUsername` / `getById` query the preload feeds, so
  no new provider plumbing is needed.

## Verification

After wiring optimistic updates:

1. Run the feature's existing E2E suite — observable end-state is
   unchanged, so all tests should still pass without modification.
2. Manual UX check (Chrome MCP or `pnpm dev`): create / edit / delete a
   row and confirm the list updates BEFORE the dialog finishes its close
   animation. If you see a perceptible delay, the optimism didn't take.
3. Rollback path: temporarily lower a server-side cap (or simulate a
   validation error), trigger the mutation, and confirm the optimistic
   row appears, then disappears, and the existing error UI fires.
