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
      <h2 className="text-[13px] font-medium text-foreground">
        Customize how your AI clone speaks.
      </h2>
      <Button
        type="submit"
        form={formId}
        variant="primary"
        size="xs"
        className="ml-2"
        disabled={isPending}
      >
        {isPending ? "Saving..." : "Save"}
      </Button>
    </ContentToolbarShell>
  );
}
