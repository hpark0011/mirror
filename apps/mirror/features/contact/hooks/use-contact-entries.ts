"use client";

import { useMemo } from "react";
import { useMutation, usePreloadedQuery } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { useContactWorkspace } from "../context/contact-workspace-context";
import {
  CONTACT_ENTRY_KINDS,
  type ContactEntry,
  type ContactEntryKind,
} from "../types";

// One entry per platform — the implicit cap is `CONTACT_ENTRY_KINDS.length`.
// Mirrors the soft-cap pattern at packages/convex/convex/contacts/queries.ts
// and the server `create` rejection at contacts/mutations.ts.
export const MAX_CONTACT_ENTRIES = CONTACT_ENTRY_KINDS.length;

function sortAndCap<T extends { _creationTime: number }>(
  entries: ReadonlyArray<T>,
): Array<T> {
  const sorted = [...entries].sort((a, b) => b._creationTime - a._creationTime);
  return sorted.slice(0, MAX_CONTACT_ENTRIES);
}

/**
 * Reads the workspace-provided preloaded query for the current `[username]`
 * route and exposes memoized create/update/remove handles to feature
 * components. All three mutations are wrapped with `withOptimisticUpdate`
 * so the list reflects changes synchronously; Convex auto-rolls-back the
 * optimistic patch if the mutation rejects (e.g. one-per-platform conflict).
 */
export function useContactEntries(): {
  entries: ReadonlyArray<ContactEntry>;
  username: string;
  /**
   * Platforms NOT already populated — drives the kind select's option list
   * in create mode and the Add CTA's disabled state.
   */
  availableKinds: ReadonlyArray<ContactEntryKind>;
  canCreateEntry: boolean;
  createEntry: ReturnType<
    typeof useMutation<typeof api.contacts.mutations.create>
  >;
  updateEntry: ReturnType<
    typeof useMutation<typeof api.contacts.mutations.update>
  >;
  removeEntry: ReturnType<
    typeof useMutation<typeof api.contacts.mutations.remove>
  >;
} {
  const { preloadedContactEntries, username } = useContactWorkspace();
  const reactive = usePreloadedQuery(preloadedContactEntries);

  const entries = useMemo<ReadonlyArray<ContactEntry>>(
    () => (reactive ?? []) as ReadonlyArray<ContactEntry>,
    [reactive],
  );

  const usedKinds = useMemo(
    () => new Set(entries.map((entry) => entry.kind)),
    [entries],
  );

  const availableKinds = useMemo<ReadonlyArray<ContactEntryKind>>(
    () => CONTACT_ENTRY_KINDS.filter((kind) => !usedKinds.has(kind)),
    [usedKinds],
  );

  const createMutation = useMutation(api.contacts.mutations.create);
  const updateMutation = useMutation(api.contacts.mutations.update);
  const removeMutation = useMutation(api.contacts.mutations.remove);

  const createEntry = useMemo(
    () =>
      createMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.contacts.queries.getByUsername, {
          username,
        });
        if (current == null) return;

        type Entry = (typeof current)[number];

        // userId is never read by the contact card UI. Borrow from any
        // existing entry; fall back to a placeholder cast for the
        // first-entry case. _creationTime: MAX_SAFE_INTEGER pins the
        // optimistic row to the top until the real value arrives.
        const optimistic: Entry = {
          _id: crypto.randomUUID() as Id<"contactEntries">,
          _creationTime: Number.MAX_SAFE_INTEGER,
          userId: current[0]?.userId ?? ("__optimistic__" as Id<"users">),
          kind: args.kind,
          value: args.value,
        };

        store.setQuery(
          api.contacts.queries.getByUsername,
          { username },
          sortAndCap<Entry>([...current, optimistic]),
        );
      }),
    [createMutation, username],
  );

  const updateEntry = useMemo(
    () =>
      updateMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.contacts.queries.getByUsername, {
          username,
        });
        if (current == null) return;

        type Entry = (typeof current)[number];

        const patched: Array<Entry> = current.map((entry) => {
          if (entry._id !== args.id) return entry;
          return { ...entry, value: args.value };
        });

        store.setQuery(
          api.contacts.queries.getByUsername,
          { username },
          sortAndCap<Entry>(patched),
        );
      }),
    [updateMutation, username],
  );

  const removeEntry = useMemo(
    () =>
      removeMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.contacts.queries.getByUsername, {
          username,
        });
        if (current == null) return;
        store.setQuery(
          api.contacts.queries.getByUsername,
          { username },
          current.filter((e) => e._id !== args.id),
        );
      }),
    [removeMutation, username],
  );

  const canCreateEntry = availableKinds.length > 0;

  return {
    entries,
    username,
    availableKinds,
    canCreateEntry,
    createEntry,
    updateEntry,
    removeEntry,
  };
}
