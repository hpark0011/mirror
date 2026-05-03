"use client";

import { Button } from "@feel-good/ui/primitives/button";
import { ContentToolbarShell } from "@/features/content";

type CloneSettingsToolbarProps = {
  formId: string;
  isPending: boolean;
};

export function CloneSettingsToolbar({
  formId,
  isPending,
}: CloneSettingsToolbarProps) {
  return (
    <ContentToolbarShell variant="detail">
      <Button
        type="submit"
        form={formId}
        variant="primary"
        size="xs"
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save"}
      </Button>
    </ContentToolbarShell>
  );
}
