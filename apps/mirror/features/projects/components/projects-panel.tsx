"use client";

import { useTranslation } from "react-i18next";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";
import { useIsProfileOwner } from "@/features/profile";
import { MAX_PROJECTS } from "@/features/projects/hooks/use-projects";
import { useProjectsPanelHandlers } from "@/features/projects/hooks/use-projects-panel-handlers";
import { ProjectAddButton } from "@/features/projects/components/project-add-button";
import { ProjectFormDialog } from "@/features/projects/components/project-form-dialog";
import { ProjectList } from "@/features/projects/components/project-list";
import { ProjectsToolbar } from "@/features/projects/components/projects-toolbar";

export function ProjectsPanel() {
  const { t } = useTranslation();
  const isOwner = useIsProfileOwner();
  const {
    projects,
    canCreateProject,
    dialog,
    openCreate,
    openEdit,
    closeDialog,
    handleDelete,
    handleSubmit,
    pendingDeletes,
  } = useProjectsPanelHandlers();

  const addDisabled = !canCreateProject;
  const addDisabledReason = addDisabled
    ? t("projects.limitReached", {
        maxProjects: MAX_PROJECTS,
        defaultValue: `Project limit reached (${MAX_PROJECTS}). Delete a project to add another.`,
      })
    : undefined;

  return (
    <>
      <WorkspaceToolbar>
        <ProjectsToolbar
          isOwner={isOwner}
          addDisabled={addDisabled}
          addDisabledReason={addDisabledReason}
          onAddClick={openCreate}
        />
      </WorkspaceToolbar>
      <div
        data-testid="projects-panel"
        className="flex flex-col gap-2 p-4 max-w-2xl mx-auto py-12 h-full"
      >
        {projects.length !== 0 ? (
          <p className="text-[15px] mb-4">
            {t("projects.panel.intro", {
              defaultValue: "Projects and recent work.",
            })}
          </p>
        ) : null}

        <ProjectList
          projects={projects}
          isOwner={isOwner}
          onEdit={openEdit}
          onDelete={handleDelete}
          pendingDeletes={pendingDeletes}
          ownerEmptyAction={
            isOwner ? (
              <ProjectAddButton
                onClick={openCreate}
                disabled={addDisabled}
                disabledReason={addDisabledReason}
              >
                {t("projects.addButton.first", {
                  defaultValue: "Add first project",
                })}
              </ProjectAddButton>
            ) : undefined
          }
        />

        {isOwner ? (
          <ProjectFormDialog
            open={dialog.open}
            mode={dialog.open ? dialog.mode : "create"}
            project={
              dialog.open && dialog.mode === "edit" ? dialog.project : undefined
            }
            onOpenChange={(open) => {
              if (!open) closeDialog();
            }}
            onSubmit={handleSubmit}
          />
        ) : null}
      </div>
    </>
  );
}
