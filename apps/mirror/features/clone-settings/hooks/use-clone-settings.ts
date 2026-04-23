"use client";

import { useCallback, useRef, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type TonePreset } from "@feel-good/convex/chat/tonePresets";
import {
  cloneSettingsSchema,
  type CloneSettingsFormValues,
} from "@/features/clone-settings/lib/schemas/clone-settings.schema";

type CurrentProfile = ReturnType<
  typeof useQuery<typeof api.users.queries.getCurrentProfile>
>;

type UseCloneSettingsResult = {
  form: UseFormReturn<CloneSettingsFormValues>;
  profile: CurrentProfile;
  isPending: boolean;
  handleSubmit: (data: CloneSettingsFormValues) => Promise<void>;
  handleClear: () => Promise<void>;
};

export function useCloneSettings(): UseCloneSettingsResult {
  const profile = useQuery(api.users.queries.getCurrentProfile);
  const updatePersonaSettings = useMutation(
    api.users.mutations.updatePersonaSettings,
  );

  const form = useForm<CloneSettingsFormValues>({
    resolver: zodResolver(cloneSettingsSchema),
    defaultValues: {
      personaPrompt: null,
      topicsToAvoid: null,
      tonePreset: null,
    },
    values: profile
      ? {
          personaPrompt: profile.personaPrompt ?? null,
          topicsToAvoid: profile.topicsToAvoid ?? null,
          tonePreset:
            (profile.tonePreset as TonePreset | null | undefined) ?? null,
        }
      : undefined,
  });

  const pendingRef = useRef(false);
  const [isPending, setIsPending] = useState(false);

  const runWithPending = useCallback(async (action: () => Promise<void>) => {
    if (pendingRef.current) {
      return;
    }

    pendingRef.current = true;
    setIsPending(true);

    try {
      return await action();
    } finally {
      pendingRef.current = false;
      setIsPending(false);
    }
  }, []);

  const handleSubmit = useCallback(
    async (data: CloneSettingsFormValues) => {
      await runWithPending(async () => {
        await updatePersonaSettings({
          personaPrompt: data.personaPrompt,
          tonePreset: data.tonePreset,
          topicsToAvoid: data.topicsToAvoid,
        });
        form.reset(data);
      });
    },
    [form, runWithPending, updatePersonaSettings],
  );

  const handleClear = useCallback(async () => {
    await runWithPending(async () => {
      const cleared: CloneSettingsFormValues = {
        personaPrompt: null,
        tonePreset: null,
        topicsToAvoid: null,
      };
      await updatePersonaSettings({
        personaPrompt: null,
        tonePreset: null,
        topicsToAvoid: null,
      });
      form.reset(cleared);
    });
  }, [form, runWithPending, updatePersonaSettings]);

  return {
    form,
    profile,
    isPending,
    handleSubmit,
    handleClear,
  };
}
