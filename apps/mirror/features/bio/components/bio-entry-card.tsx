"use client";

import { type BioEntry } from "../types";
import { formatDateRange } from "../lib/format-date-range";
import { Button } from "@feel-good/ui/primitives/button";

type BioEntryCardProps = {
  entry: BioEntry;
  isOwner: boolean;
  onEdit: (entry: BioEntry) => void;
  onDelete: (entry: BioEntry) => void;
  isDeleting?: boolean;
};

export function BioEntryCard({
  entry,
  isOwner,
  onEdit,
  onDelete,
  isDeleting = false,
}: BioEntryCardProps) {
  const dateRange = formatDateRange(entry.startDate, entry.endDate);
  const description = entry.description?.trim();
  const link = entry.link?.trim();

  return (
    <article
      data-testid="bio-entry-card"
      data-kind={entry.kind}
      className="flex text-card-foreground gap-8"
    >
      <p className="text-[15px] text-foreground leading-[1.2] whitespace-nowrap max-w-[160px] w-full mt-[2px]">
        {dateRange}
      </p>
      <div className="w-full flex flex-col">
        <div className="flex items-baseline w-full justify-between">
          <h3 className="text-lg font-medium leading-[1.2] text-foreground mb-2">
            {entry.title}
          </h3>

          {isOwner
            ? (
              <div className="flex shrink-0 items-baseline gap-3">
                <Button
                  size="sm"
                  variant="link"
                  onClick={() => onEdit(entry)}
                  data-testid="bio-entry-edit"
                  className="h-fit px-0"
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="link"
                  onClick={() => onDelete(entry)}
                  disabled={isDeleting}
                  data-testid="bio-entry-delete"
                  className="h-fit px-0"
                >
                  Delete
                </Button>
              </div>
            )
            : null}
        </div>
        {
          /* <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {KIND_LABELS[entry.kind]}
          </span> */
        }

        {description
          ? (
            <p className="whitespace-pre-line text-[15px] text-foreground leading-[1.3] mb-2">
              {description}
            </p>
          )
          : null}

        {link
          ? (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[15px] text-primary underline-offset-2 hover:underline leading-[1.2]"
              data-testid="bio-entry-link"
            >
              {link}
            </a>
          )
          : null}
      </div>
    </article>
  );
}
