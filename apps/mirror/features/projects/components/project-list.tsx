"use client";

import { type ReactNode } from "react";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { type Project } from "@/features/projects/types";
import { ProjectCard } from "@/features/projects/components/project-card";
import { ProjectListEmpty } from "@/features/projects/components/project-list-empty";

type ProjectListProps = {
  projects: ReadonlyArray<Project>;
  isOwner: boolean;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  pendingDeletes?: ReadonlySet<Id<"projects">>;
  ownerEmptyAction?: ReactNode;
};

export function ProjectList({
  projects,
  isOwner,
  onEdit,
  onDelete,
  pendingDeletes,
  ownerEmptyAction,
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <ProjectListEmpty isOwner={isOwner} ownerEmptyAction={ownerEmptyAction} />
    );
  }

  return (
    <ol
      data-testid="project-list"
      className="flex flex-col list-none mt-8 gap-10 pb-20"
    >
      {projects.map((project) => (
        <li key={project._id} className="flex flex-col relative">
          <ProjectCard
            project={project}
            isOwner={isOwner}
            onEdit={onEdit}
            onDelete={onDelete}
            isDeleting={pendingDeletes?.has(project._id) ?? false}
          />
        </li>
      ))}
    </ol>
  );
}
