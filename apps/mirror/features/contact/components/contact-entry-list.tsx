"use client";

import { type ReactNode } from "react";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { type ContactEntry } from "../types";
import { ContactEntryCard } from "./contact-entry-card";
import { ContactEntryListEmpty } from "./contact-entry-list-empty";

type ContactEntryListProps = {
  entries: ReadonlyArray<ContactEntry>;
  isOwner: boolean;
  onEdit: (entry: ContactEntry) => void;
  onDelete: (entry: ContactEntry) => void;
  pendingDeletes?: ReadonlySet<Id<"contactEntries">>;
  ownerEmptyAction?: ReactNode;
};

export function ContactEntryList({
  entries,
  isOwner,
  onEdit,
  onDelete,
  pendingDeletes,
  ownerEmptyAction,
}: ContactEntryListProps) {
  if (entries.length === 0) {
    return (
      <ContactEntryListEmpty
        isOwner={isOwner}
        ownerEmptyAction={ownerEmptyAction}
      />
    );
  }

  return (
    <ol
      data-testid="contact-entry-list"
      className="flex flex-col list-none mt-8 gap-6 pb-20"
    >
      {entries.map((entry) => (
        <li
          key={entry._id}
          className="flex flex-col relative"
        >
          <ContactEntryCard
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
