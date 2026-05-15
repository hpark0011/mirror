"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { showToast } from "@feel-good/ui/components/toast";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { getMutationErrorMessage } from "@/lib/get-mutation-error-message";
import { type Project } from "@/features/projects/types";
import { type ProjectFormValues } from "@/features/projects/lib/schemas/project.schema";
import { toMutationArgs } from "@/features/projects/utils/mutation-helpers";
import { useProjects } from "@/features/projects/hooks/use-projects";

export type ProjectDialogState =
  | { open: false }
  | { open: true; mode: "create" }
  | { open: true; mode: "edit"; project: Project };

export function useProjectsPanelHandlers() {
  const {
    projects,
    canCreateProject,
    createProject,
    updateProject,
    removeProject,
  } = useProjects();
  const deleteOrphanCoverImage = useMutation(
    api.projects.mutations.deleteOrphanCoverImage,
  );
  const [dialog, setDialog] = useState<ProjectDialogState>({ open: false });
  const [pendingDeletes, setPendingDeletes] = useState<
    ReadonlySet<Id<"projects">>
  >(() => new Set());
  const pendingDeletesRef = useRef<Set<Id<"projects">>>(new Set());

  const openCreate = useCallback(() => {
    setDialog({ open: true, mode: "create" });
  }, []);
  const openEdit = useCallback((project: Project) => {
    setDialog({ open: true, mode: "edit", project });
  }, []);
  const closeDialog = useCallback(() => {
    setDialog({ open: false });
  }, []);

  const cleanupUploadedCover = useCallback(
    async (values: ProjectFormValues) => {
      if (!values.coverImageStorageId) return;
      try {
        await deleteOrphanCoverImage({
          storageId: values.coverImageStorageId,
        });
      } catch (err) {
        console.warn("[projects] orphan cover cleanup failed", err);
      }
    },
    [deleteOrphanCoverImage],
  );

  const handleDelete = useCallback(
    async (project: Project) => {
      if (pendingDeletesRef.current.has(project._id)) return;
      pendingDeletesRef.current.add(project._id);
      setPendingDeletes((prev) => {
        const next = new Set(prev);
        next.add(project._id);
        return next;
      });

      try {
        await removeProject({ id: project._id });
      } catch (err) {
        showToast({ type: "error", title: getMutationErrorMessage(err) });
      } finally {
        pendingDeletesRef.current.delete(project._id);
        setPendingDeletes((prev) => {
          if (!prev.has(project._id)) return prev;
          const next = new Set(prev);
          next.delete(project._id);
          return next;
        });
      }
    },
    [removeProject],
  );

  const handleSubmit = useCallback(
    async (values: ProjectFormValues) => {
      const args = toMutationArgs(values);
      const editId =
        dialog.open && dialog.mode === "edit" ? dialog.project._id : null;

      try {
        if (editId !== null) {
          await updateProject({ id: editId, ...args });
        } else {
          await createProject({
            title: args.title,
            startDate: args.startDate,
            endDate: args.endDate,
            ...(args.description !== undefined
              ? { description: args.description }
              : {}),
            ...(args.link !== undefined ? { link: args.link } : {}),
            ...(args.coverImageStorageId !== undefined
              ? { coverImageStorageId: args.coverImageStorageId }
              : {}),
            ...(args.coverImageThumbhash !== undefined
              ? { coverImageThumbhash: args.coverImageThumbhash }
              : {}),
          });
        }
        setDialog({ open: false });
      } catch (err) {
        await cleanupUploadedCover(values);
        showToast({ type: "error", title: getMutationErrorMessage(err) });
      }
    },
    [cleanupUploadedCover, createProject, dialog, updateProject],
  );

  return {
    projects,
    canCreateProject,
    dialog,
    openCreate,
    openEdit,
    closeDialog,
    handleDelete,
    handleSubmit,
    pendingDeletes,
  };
}
