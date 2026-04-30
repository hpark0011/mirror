"use client";

import { Button } from "@feel-good/ui/primitives/button";

type BioAddEntryButtonProps = {
  onClick: () => void;
  children?: React.ReactNode;
};

export function BioAddEntryButton({
  onClick,
  children,
}: BioAddEntryButtonProps) {
  return (
    <Button
      type="button"
      onClick={onClick}
      variant="default"
      size="sm"
      data-testid="bio-add-entry-button"
    >
      {children ?? "Add entry"}
    </Button>
  );
}
