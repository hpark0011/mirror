"use client";

import { type BioEntry } from "../types";
import { formatDateRange } from "../lib/format-date-range";
import { Button } from "@feel-good/ui/primitives/button";

const KIND_LABELS: Record<BioEntry["kind"], string> = {
  work: "Work",
  education: "Education",
};

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
      className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 text-card-foreground"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {KIND_LABELS[entry.kind]}
          </span>
          <h3 className="text-base font-semibold leading-snug text-foreground">
            {entry.title}
          </h3>
          <p className="text-sm text-muted-foreground">{dateRange}</p>
        </div>
        {isOwner ? (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(entry)}
              data-testid="bio-entry-edit"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(entry)}
              disabled={isDeleting}
              data-testid="bio-entry-delete"
            >
              Delete
            </Button>
          </div>
        ) : null}
      </header>

      {description ? (
        <p className="whitespace-pre-line text-sm text-foreground">
          {description}
        </p>
      ) : null}

      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
          data-testid="bio-entry-link"
        >
          {link}
        </a>
      ) : null}
    </article>
  );
}
