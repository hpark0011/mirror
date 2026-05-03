"use client";

import { ContentToolbarShell } from "@/features/content";
import { BioAddEntryButton } from "./bio-add-entry-button";

type BioToolbarProps = {
  isOwner: boolean;
  addDisabled: boolean;
  addDisabledReason?: string;
  onAddClick: () => void;
};

export function BioToolbar({
  isOwner,
  addDisabled,
  addDisabledReason,
  onAddClick,
}: BioToolbarProps) {
  return (
    <ContentToolbarShell variant="detail">
      <div className="text-[13px]">Work and education history.</div>
      {isOwner
        ? (
          <BioAddEntryButton
            onClick={onAddClick}
            disabled={addDisabled}
            disabledReason={addDisabledReason}
          />
        )
        : null}
    </ContentToolbarShell>
  );
}
