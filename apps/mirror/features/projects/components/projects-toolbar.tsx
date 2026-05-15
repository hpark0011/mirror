"use client";

import { ContentToolbarShell } from "@/features/content";
import { ProjectAddButton } from "./project-add-button";

type ProjectsToolbarProps = {
  isOwner: boolean;
  addDisabled: boolean;
  addDisabledReason?: string;
  onAddClick: () => void;
};

export function ProjectsToolbar({
  isOwner,
  addDisabled,
  addDisabledReason,
  onAddClick,
}: ProjectsToolbarProps) {
  return (
    <ContentToolbarShell variant="detail">
      <div />
      {isOwner ? (
        <ProjectAddButton
          onClick={onAddClick}
          disabled={addDisabled}
          disabledReason={addDisabledReason}
        />
      ) : null}
    </ContentToolbarShell>
  );
}
