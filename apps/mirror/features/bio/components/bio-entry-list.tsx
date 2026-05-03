"use client";

import { type ReactNode } from "react";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { type BioEntry } from "../types";
import { BioEntryCard } from "./bio-entry-card";
import { BioEntryListEmpty } from "./bio-entry-list-empty";

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
      <BioEntryListEmpty isOwner={isOwner} ownerEmptyAction={ownerEmptyAction} />
    );
  }

  return (
    <ol
      data-testid="bio-entry-list"
      className="flex flex-col list-none mt-8 gap-10"
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
