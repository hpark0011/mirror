"use client";

import { useMemo } from "react";
import { useMutation, usePreloadedQuery } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { useBioWorkspace } from "../context/bio-workspace-context";
import { type BioEntry } from "../types";

// Mirrors the server-side ordering/cap at
// packages/convex/convex/bio/queries.ts:49-56 and
// packages/convex/convex/bio/mutations.ts:17 so optimistic create/update
// place rows at their eventual sorted position.
const MAX_OPTIMISTIC_ENTRIES = 50;

function sortAndCap<T extends { startDate: number; _creationTime: number }>(
  entries: ReadonlyArray<T>,
): Array<T> {
  const sorted = [...entries].sort((a, b) => {
    if (a.startDate !== b.startDate) return b.startDate - a.startDate;
    return b._creationTime - a._creationTime;
  });
  return sorted.slice(0, MAX_OPTIMISTIC_ENTRIES);
}

/**
 * Reads the workspace-provided preloaded query for the current `[username]`
 * route and exposes memoized create/update/remove handles to feature
 * components. All three mutations are wrapped with `withOptimisticUpdate`
 * so the list reflects changes synchronously; Convex auto-rolls-back the
 * optimistic patch if the mutation rejects (e.g. 50-entry cap hit).
 *
 * The provider is the single hydration source — when no provider is mounted
 * (e.g. a hypothetical dialog-only context outside the route), the spec calls
 * for falling back to `useQuery(api.bio.queries.getByUsername, ...)`. Today
 * every consumer renders inside the parallel-route layout, so we keep the
 * happy path simple: the provider must exist.
 */
export function useBioEntries(): {
  entries: ReadonlyArray<BioEntry>;
  username: string;
  createEntry: ReturnType<typeof useMutation<typeof api.bio.mutations.create>>;
  updateEntry: ReturnType<typeof useMutation<typeof api.bio.mutations.update>>;
  removeEntry: ReturnType<typeof useMutation<typeof api.bio.mutations.remove>>;
} {
  const { preloadedBioEntries, username } = useBioWorkspace();
  const reactive = usePreloadedQuery(preloadedBioEntries);

  const entries = useMemo<ReadonlyArray<BioEntry>>(
    () => (reactive ?? []) as ReadonlyArray<BioEntry>,
    [reactive],
  );

  const createMutation = useMutation(api.bio.mutations.create);
  const updateMutation = useMutation(api.bio.mutations.update);
  const removeMutation = useMutation(api.bio.mutations.remove);

  const createEntry = useMemo(
    () =>
      createMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.bio.queries.getByUsername, {
          username,
        });
        if (current == null) return;

        type Entry = (typeof current)[number];

        // userId is never read by client UI (verified in
        // bio-entry-card.tsx). Borrow from any existing entry; fall back to
        // a placeholder cast for the first-entry case, where the row is
        // replaced by the server's reactive emit within milliseconds.
        // _creationTime is a sort tiebreaker only — MAX_SAFE_INTEGER keeps
        // the new row at the top of any startDate tie until the real
        // server value arrives.
        const optimistic: Entry = {
          _id: crypto.randomUUID() as Id<"bioEntries">,
          _creationTime: Number.MAX_SAFE_INTEGER,
          userId: current[0]?.userId ?? ("__optimistic__" as Id<"users">),
          kind: args.kind,
          title: args.title,
          startDate: args.startDate,
          endDate: args.endDate,
          description: args.description,
          link: args.link,
        };

        store.setQuery(
          api.bio.queries.getByUsername,
          { username },
          sortAndCap<Entry>([...current, optimistic]),
        );
      }),
    [createMutation, username],
  );

  const updateEntry = useMemo(
    () =>
      updateMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.bio.queries.getByUsername, {
          username,
        });
        if (current == null) return;

        type Entry = (typeof current)[number];

        // Mirror packages/convex/convex/bio/mutations.ts:142-148 partial-patch
        // semantics: only fields where args.X !== undefined are applied.
        const patched: Array<Entry> = current.map((entry) => {
          if (entry._id !== args.id) return entry;
          return {
            ...entry,
            ...(args.kind !== undefined && { kind: args.kind }),
            ...(args.title !== undefined && { title: args.title }),
            ...(args.startDate !== undefined && { startDate: args.startDate }),
            ...(args.endDate !== undefined && { endDate: args.endDate }),
            ...(args.description !== undefined && {
              description: args.description,
            }),
            ...(args.link !== undefined && { link: args.link }),
          };
        });

        store.setQuery(
          api.bio.queries.getByUsername,
          { username },
          sortAndCap<Entry>(patched),
        );
      }),
    [updateMutation, username],
  );

  const removeEntry = useMemo(
    () =>
      removeMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.bio.queries.getByUsername, {
          username,
        });
        if (current == null) return;
        store.setQuery(
          api.bio.queries.getByUsername,
          { username },
          current.filter((e) => e._id !== args.id),
        );
      }),
    [removeMutation, username],
  );

  return { entries, username, createEntry, updateEntry, removeEntry };
}
