"use client";

import { useTranslation } from "react-i18next";
import { Icon } from "@feel-good/ui/components/icon";
import { Button } from "@feel-good/ui/primitives/button";
import { type Project } from "@/features/projects/types";
import { formatDateRange } from "@/features/projects/lib/format-date-range";
import { safeHttpUrl } from "@/features/projects/lib/safe-http-url";

type ProjectCardProps = {
  project: Project;
  isOwner: boolean;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  isDeleting?: boolean;
};

export function ProjectCard({
  project,
  isOwner,
  onEdit,
  onDelete,
  isDeleting = false,
}: ProjectCardProps) {
  const { t } = useTranslation();
  const dateRange = formatDateRange(project.startDate, project.endDate);
  const description = project.description?.trim();
  const link = safeHttpUrl(project.link);

  return (
    <article
      data-testid="project-card"
      className="group flex flex-col gap-3 text-foreground sm:flex-row"
    >
      <div className="w-full sm:w-40 shrink-0">
        {project.coverImageUrl ? (
          <div className="overflow-hidden rounded-lg border border-border-subtle bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.coverImageUrl}
              alt={t("projects.card.coverAlt", {
                title: project.title,
                defaultValue: `Cover image for ${project.title}`,
              })}
              className="aspect-[16/10] w-full object-cover"
              data-testid="project-cover-image"
            />
          </div>
        ) : (
          <div
            className="aspect-[16/10] w-full rounded-lg border border-border-subtle bg-muted/40"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-[13px] leading-[1.2] text-muted-foreground">
              {dateRange}
            </p>
            <h3 className="text-base font-medium leading-[1.2] text-foreground underline">
              {project.title}
            </h3>
          </div>

          {isOwner ? (
            <div className="flex h-[16px] shrink-0 items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <Button
                size="sm"
                variant="link"
                onClick={() => onEdit(project)}
                data-testid="project-edit"
                className="h-fit px-0 underline-offset-2 font-normal"
              >
                {t("projects.card.edit", { defaultValue: "Edit" })}
              </Button>
              <span className="text-xs pb-0.5">/</span>
              <Button
                size="sm"
                variant="link"
                onClick={() => onDelete(project)}
                disabled={isDeleting}
                data-testid="project-delete"
                className="h-fit px-0 underline-offset-2 font-normal"
              >
                {t("projects.card.delete", { defaultValue: "Delete" })}
              </Button>
            </div>
          ) : null}
        </div>

        {description ? (
          <p className="mt-2 whitespace-pre-line text-[15px] leading-[1.3]">
            {description}
          </p>
        ) : null}

        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex w-fit items-center gap-1 text-[15px] leading-[1.2] text-primary underline-offset-2 hover:underline"
            data-testid="project-link"
          >
            <Icon name="LinkIcon" className="size-4" />
            {link}
          </a>
        ) : null}
      </div>
    </article>
  );
}
