"use client";

import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

type ProjectListEmptyProps = {
  isOwner: boolean;
  ownerEmptyAction?: ReactNode;
};

export function ProjectListEmpty({
  isOwner,
  ownerEmptyAction,
}: ProjectListEmptyProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid="project-list-empty"
      className="flex flex-col items-center gap-3 p-6 h-full justify-center"
    >
      {isOwner ? (
        <div className="flex flex-col items-center justify-center gap-4">
          <h3 className="text-lg text-foreground">
            {t("projects.empty.owner", {
              defaultValue: "Add a project you want readers to see",
            })}
          </h3>
          {ownerEmptyAction}
        </div>
      ) : (
        <p className="text-[15px] text-muted-foreground text-center w-full">
          {t("projects.empty.visitor", { defaultValue: "No projects yet." })}
        </p>
      )}
    </div>
  );
}
