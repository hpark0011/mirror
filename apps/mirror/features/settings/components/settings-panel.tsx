"use client";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import { useTranslation } from "react-i18next";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";
import { useProfileSettings } from "@/features/settings/hooks/use-profile-settings";
import { DefaultContentTypeSelect } from "./default-content-type-select";
import { SettingsToolbar } from "./settings-toolbar";

const PROFILE_SETTINGS_FORM_ID = "profile-settings-form";

export function SettingsPanel() {
  const { t } = useTranslation();
  const { form, profile, isPending, saveCount, handleSubmit } =
    useProfileSettings();
  const isSaveDisabled = isPending || !profile;

  return (
    <>
      <WorkspaceToolbar>
        <SettingsToolbar
          formId={PROFILE_SETTINGS_FORM_ID}
          isPending={isPending}
          isSaveDisabled={isSaveDisabled}
        />
      </WorkspaceToolbar>
      <div
        data-testid="settings-panel"
        className="p-4 py-12 mx-auto w-full max-w-xl"
      >
        <p className="text-[15px] mb-4">
          {t("settings.panel.description", {
            defaultValue: "Profile settings.",
          })}
        </p>
        <Form {...form}>
          <form
            id={PROFILE_SETTINGS_FORM_ID}
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
            data-profile-settings-saving={isPending ? "true" : "false"}
            data-profile-settings-save-count={String(saveCount)}
          >
            <FormField
              control={form.control}
              name="defaultProfileSection"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t("settings.defaultContentType.label", {
                      defaultValue: "Default content type",
                    })}
                  </FormLabel>
                  <FormDescription>
                    {t("settings.defaultContentType.description", {
                      defaultValue:
                        "Choose which section opens first on your profile.",
                    })}
                  </FormDescription>
                  <FormControl>
                    <DefaultContentTypeSelect
                      value={field.value}
                      onChange={field.onChange}
                      disabled={!profile || isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
    </>
  );
}
