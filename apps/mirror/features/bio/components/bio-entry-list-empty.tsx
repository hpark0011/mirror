import { type ReactNode } from "react";

type BioEntryListEmptyProps = {
  isOwner: boolean;
  ownerEmptyAction?: ReactNode;
};

export function BioEntryListEmpty({
  isOwner,
  ownerEmptyAction,
}: BioEntryListEmptyProps) {
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
