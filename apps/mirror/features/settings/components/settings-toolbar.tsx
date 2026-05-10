"use client";

import { Button } from "@feel-good/ui/primitives/button";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();

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
        {isPending
          ? t("settings.toolbar.saving", { defaultValue: "Saving..." })
          : t("settings.toolbar.save", { defaultValue: "Save" })}
      </Button>
    </ContentToolbarShell>
  );
}
