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
    <div // data-testid="bio-entry-list-empty"
     className="flex flex-col items-center gap-3 p-6 h-full justify-center">
      {isOwner
        ? (
          <div className="flex flex-col items-center justify-center gap-4">
            <h3 className="text-lg text-foreground">
              Tell readers a bit about your background
            </h3>
            {ownerEmptyAction}
          </div>
        )
        : (
          <p className="text-[15px] text-muted-foreground text-center w-full">
            No entries yet.
          </p>
        )}
    </div>
  );
}
