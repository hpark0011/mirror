import { type ReactNode } from "react";

type ContactEntryListEmptyProps = {
  isOwner: boolean;
  ownerEmptyAction?: ReactNode;
};

export function ContactEntryListEmpty({
  isOwner,
  ownerEmptyAction,
}: ContactEntryListEmptyProps) {
  return (
    <div
      data-testid="contact-entry-list-empty"
      className="flex flex-col items-center gap-3 p-6 h-full justify-center"
    >
      {isOwner
        ? (
          <div className="flex flex-col items-center justify-center gap-4">
            <h3 className="text-lg text-foreground">
              Add your email or social profile links
            </h3>
            {ownerEmptyAction}
          </div>
        )
        : (
          <p className="text-[15px] text-muted-foreground text-center w-full">
            No contact information yet.
          </p>
        )}
    </div>
  );
}
