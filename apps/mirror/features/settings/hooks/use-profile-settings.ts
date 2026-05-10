"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { showToast } from "@feel-good/ui/components/toast";
import { api } from "@feel-good/convex/convex/_generated/api";
import { DEFAULT_PROFILE_SECTION } from "@feel-good/convex/convex/content/href";
import { useTranslation } from "react-i18next";
import {
  profileSettingsSchema,
  type ProfileSettingsFormValues,
} from "@/features/settings/lib/schemas/profile-settings.schema";

type CurrentProfile = ReturnType<
  typeof useQuery<typeof api.users.queries.getCurrentProfile>
>;

type UseProfileSettingsResult = {
  form: UseFormReturn<ProfileSettingsFormValues>;
  profile: CurrentProfile;
  isPending: boolean;
  saveCount: number;
  handleSubmit: (data: ProfileSettingsFormValues) => Promise<void>;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useProfileSettings(): UseProfileSettingsResult {
  const { t } = useTranslation();
  const profile = useQuery(api.users.queries.getCurrentProfile);
  const updateProfileSettingsMutation = useMutation(
    api.users.mutations.updateProfileSettings,
  );
  const updateProfileSettings = useMemo(
    () =>
      updateProfileSettingsMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.users.queries.getCurrentProfile, {});
        if (current == null) return;

        store.setQuery(
          api.users.queries.getCurrentProfile,
          {},
          {
            ...current,
            defaultProfileSection: args.defaultProfileSection,
          },
        );
      }),
    [updateProfileSettingsMutation],
  );

  const form = useForm<ProfileSettingsFormValues>({
    resolver: zodResolver(profileSettingsSchema),
    defaultValues: {
      defaultProfileSection: DEFAULT_PROFILE_SECTION,
    },
    values: profile
      ? {
          defaultProfileSection:
            profile.defaultProfileSection ?? DEFAULT_PROFILE_SECTION,
        }
      : undefined,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  const pendingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);
  const [saveCount, setSaveCount] = useState(0);

  const runWithPending = useCallback(async (action: () => Promise<void>) => {
    if (pendingRef.current) return;

    pendingRef.current = true;
    setIsPending(true);

    try {
      await action();
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }, []);

  const handleSubmit = useCallback(
    async (data: ProfileSettingsFormValues) => {
      await runWithPending(async () => {
        try {
          await updateProfileSettings({
            defaultProfileSection: data.defaultProfileSection,
          });
          form.reset(data);
          setSaveCount((count) => count + 1);
          showToast({
            type: "success",
            title: t("settings.toast.saved", {
              defaultValue: "Settings saved",
            }),
          });
        } catch (error) {
          showToast({
            type: "error",
            title: t("settings.toast.saveFailed", {
              defaultValue: "Failed to save settings",
            }),
            description: getErrorMessage(
              error,
              t("settings.toast.unableToSave", {
                defaultValue: "Unable to save settings",
              }),
            ),
          });
        }
      });
    },
    [form, runWithPending, t, updateProfileSettings],
  );

  return {
    form,
    profile,
    isPending,
    saveCount,
    handleSubmit,
  };
}
