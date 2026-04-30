"use client";

import { useMemo } from "react";
import { useMutation, usePreloadedQuery } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { useBioWorkspace } from "../context/bio-workspace-context";
import { type BioEntry } from "../types";

/**
 * Reads the workspace-provided preloaded query for the current `[username]`
 * route and exposes memoized create/update/remove handles to feature
 * components.
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

  const createEntry = useMutation(api.bio.mutations.create);
  const updateEntry = useMutation(api.bio.mutations.update);
  const removeEntry = useMutation(api.bio.mutations.remove);

  return { entries, username, createEntry, updateEntry, removeEntry };
}
