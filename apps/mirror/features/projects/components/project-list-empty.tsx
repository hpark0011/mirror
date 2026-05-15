import { type ReactNode } from "react";

type ProjectListEmptyProps = {
  isOwner: boolean;
  ownerEmptyAction?: ReactNode;
};

export function ProjectListEmpty({
  isOwner,
  ownerEmptyAction,
}: ProjectListEmptyProps) {
  return (
    <div
      data-testid="project-list-empty"
      className="flex flex-col items-center gap-3 p-6 h-full justify-center"
    >
      {isOwner ? (
        <div className="flex flex-col items-center justify-center gap-4">
          <h3 className="text-lg text-foreground">
            Add a project you want readers to see
          </h3>
          {ownerEmptyAction}
        </div>
      ) : (
        <p className="text-[15px] text-muted-foreground text-center w-full">
          No projects yet.
        </p>
      )}
    </div>
  );
}
