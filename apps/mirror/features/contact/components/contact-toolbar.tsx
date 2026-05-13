"use client";

import { ContentToolbarShell } from "@/features/content";
import { ContactAddEntryButton } from "./contact-add-entry-button";

type ContactToolbarProps = {
  isOwner: boolean;
  addDisabled: boolean;
  addDisabledReason?: string;
  onAddClick: () => void;
};

export function ContactToolbar({
  isOwner,
  addDisabled,
  addDisabledReason,
  onAddClick,
}: ContactToolbarProps) {
  return (
    <ContentToolbarShell variant="detail">
      <div />
      {isOwner
        ? (
          <ContactAddEntryButton
            onClick={onAddClick}
            disabled={addDisabled}
            disabledReason={addDisabledReason}
          />
        )
        : null}
    </ContentToolbarShell>
  );
}
