"use client";

import { useMemo } from "react";
import { useMutation, usePreloadedQuery } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { useProjectsWorkspace } from "@/features/projects/context/projects-workspace-context";
import { type Project } from "@/features/projects/types";

export const MAX_PROJECTS = 50;

function sortAndCap<T extends { startDate: number; _creationTime: number }>(
  projects: ReadonlyArray<T>,
): Array<T> {
  const sorted = [...projects].sort((a, b) => {
    if (a.startDate !== b.startDate) return b.startDate - a.startDate;
    return b._creationTime - a._creationTime;
  });
  return sorted.slice(0, MAX_PROJECTS);
}

export function useProjects(): {
  projects: ReadonlyArray<Project>;
  username: string;
  canCreateProject: boolean;
  createProject: ReturnType<
    typeof useMutation<typeof api.projects.mutations.create>
  >;
  updateProject: ReturnType<
    typeof useMutation<typeof api.projects.mutations.update>
  >;
  removeProject: ReturnType<
    typeof useMutation<typeof api.projects.mutations.remove>
  >;
} {
  const { preloadedProjects, username } = useProjectsWorkspace();
  const reactive = usePreloadedQuery(preloadedProjects);

  const projects = useMemo<ReadonlyArray<Project>>(
    () => (reactive ?? []) as ReadonlyArray<Project>,
    [reactive],
  );

  const createMutation = useMutation(api.projects.mutations.create);
  const updateMutation = useMutation(api.projects.mutations.update);
  const removeMutation = useMutation(api.projects.mutations.remove);

  const createProject = useMemo(
    () =>
      createMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.projects.queries.getByUsername, {
          username,
        });
        if (current == null) return;

        type Entry = (typeof current)[number];
        const optimistic: Entry = {
          _id: crypto.randomUUID() as Id<"projects">,
          _creationTime: Number.MAX_SAFE_INTEGER,
          userId: current[0]?.userId ?? ("__optimistic__" as Id<"users">),
          title: args.title,
          startDate: args.startDate,
          endDate: args.endDate,
          description: args.description,
          link: args.link,
          coverImageUrl: null,
          coverImageThumbhash: args.coverImageThumbhash ?? null,
          createdAt: Number.MAX_SAFE_INTEGER,
          updatedAt: Number.MAX_SAFE_INTEGER,
        };

        store.setQuery(
          api.projects.queries.getByUsername,
          { username },
          sortAndCap<Entry>([...current, optimistic]),
        );
      }),
    [createMutation, username],
  );

  const updateProject = useMemo(
    () =>
      updateMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.projects.queries.getByUsername, {
          username,
        });
        if (current == null) return;

        type Entry = (typeof current)[number];
        const patched: Array<Entry> = current.map((project) => {
          if (project._id !== args.id) return project;
          return {
            ...project,
            ...(args.title !== undefined && { title: args.title }),
            ...(args.startDate !== undefined && { startDate: args.startDate }),
            ...(args.endDate !== undefined && { endDate: args.endDate }),
            ...(args.description !== undefined && {
              description: args.description,
            }),
            ...(args.link !== undefined && { link: args.link }),
            ...(args.coverImageThumbhash !== undefined && {
              coverImageThumbhash: args.coverImageThumbhash || null,
            }),
            ...(args.clearCover === true && {
              coverImageUrl: null,
              coverImageThumbhash: null,
            }),
          };
        });

        store.setQuery(
          api.projects.queries.getByUsername,
          { username },
          sortAndCap<Entry>(patched),
        );
      }),
    [updateMutation, username],
  );

  const removeProject = useMemo(
    () =>
      removeMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.projects.queries.getByUsername, {
          username,
        });
        if (current == null) return;
        store.setQuery(
          api.projects.queries.getByUsername,
          { username },
          current.filter((project) => project._id !== args.id),
        );
      }),
    [removeMutation, username],
  );

  return {
    projects,
    username,
    canCreateProject: projects.length < MAX_PROJECTS,
    createProject,
    updateProject,
    removeProject,
  };
}
