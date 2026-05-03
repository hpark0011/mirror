"use client";

import { type ReactNode } from "react";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { type BioEntry } from "../types";
import { BioEntryCard } from "./bio-entry-card";

type BioEntryListProps = {
  entries: ReadonlyArray<BioEntry>;
  isOwner: boolean;
  onEdit: (entry: BioEntry) => void;
  onDelete: (entry: BioEntry) => void;
  pendingDeletes?: ReadonlySet<Id<"bioEntries">>;
  ownerEmptyAction?: ReactNode;
};

export function BioEntryList({
  entries,
  isOwner,
  onEdit,
  onDelete,
  pendingDeletes,
  ownerEmptyAction,
}: BioEntryListProps) {
  if (entries.length === 0) {
    return (
      <div
        data-testid="bio-entry-list-empty"
        className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-card p-6 text-card-foreground"
      >
        {isOwner
          ? (
            <>
              <h3 className="text-base font-semibold text-foreground">
                Tell readers a bit about your background
              </h3>
              <p className="text-sm text-muted-foreground">
                Add work and education entries to enrich your clone&apos;s
                answers.
              </p>
              {ownerEmptyAction}
            </>
          )
          : <p className="text-sm text-muted-foreground">No entries yet.</p>}
      </div>
    );
  }

  return (
    <ol
      data-testid="bio-entry-list"
      className="flex flex-col list-none mt-10 gap-10"
    >
      {entries.map((entry) => (
        <li
          key={entry._id}
          className="flex flex-col relative"
        >
          <BioEntryCard
            entry={entry}
            isOwner={isOwner}
            onEdit={onEdit}
            onDelete={onDelete}
            isDeleting={pendingDeletes?.has(entry._id) ?? false}
          />
        </li>
      ))}
    </ol>
  );
}
