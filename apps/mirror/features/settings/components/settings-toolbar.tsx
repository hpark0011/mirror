"use client";

import { Button } from "@feel-good/ui/primitives/button";
import { ContentToolbarShell } from "@/features/content";

type SettingsToolbarProps = {
  formId: string;
  isPending: boolean;
  isSaveDisabled: boolean;
};

export function SettingsToolbar({
  formId,
  isPending,
  isSaveDisabled,
}: SettingsToolbarProps) {
  return (
    <ContentToolbarShell variant="detail">
      <div />
      <Button
        type="submit"
        form={formId}
        variant="primary"
        size="xs"
        disabled={isSaveDisabled}
        data-test="profile-settings-submit-button"
      >
        {isPending ? "Saving..." : "Save"}
      </Button>
    </ContentToolbarShell>
  );
}
