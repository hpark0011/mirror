"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@feel-good/ui/primitives/dialog";
import { type Project } from "../types";
import { type ProjectFormValues } from "../lib/schemas/project.schema";
import { epochMsToMonthYear } from "../utils/month-year";
import { ProjectForm } from "./project-form";

type Mode = "create" | "edit";

type ProjectFormDialogProps = {
  open: boolean;
  mode: Mode;
  project?: Project;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
};

function getDefaultValues(project?: Project): ProjectFormValues {
  const start = project ? epochMsToMonthYear(project.startDate) : null;
  const end =
    project?.endDate != null ? epochMsToMonthYear(project.endDate) : null;
  return {
    title: project?.title ?? "",
    startMonth: start?.month ?? 1,
    startYear: start?.year ?? new Date().getUTCFullYear(),
    endMonth: end?.month ?? null,
    endYear: end?.year ?? null,
    description: project?.description ?? "",
    link: project?.link ?? "",
    coverImageStorageId: null,
    coverImageThumbhash: project?.coverImageThumbhash ?? "",
    coverImageUrl: project?.coverImageUrl ?? null,
    clearCover: false,
  };
}

export function ProjectFormDialog({
  open,
  mode,
  project,
  onOpenChange,
  onSubmit,
}: ProjectFormDialogProps) {
  const title = mode === "create" ? "Add project" : "Edit project";
  const description =
    mode === "create"
      ? "Add a project you have worked on or are working on."
      : "Update this project.";
  const submitLabel = mode === "create" ? "Add" : "Save";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-4 pt-3">
        <DialogHeader className="mb-6 gap-0">
          <DialogTitle className="text-base">{title}</DialogTitle>
          <DialogDescription className="text-[13px]">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ProjectForm
            key={project?._id ?? "new"}
            defaultValues={getDefaultValues(project)}
            submitLabel={submitLabel}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
