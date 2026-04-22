"use client";

import { useCallback, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type TonePreset } from "@feel-good/convex/chat/tonePresets";
import { Button } from "@feel-good/ui/primitives/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import {
  type CloneSettingsFormValues,
  cloneSettingsSchema,
} from "@/features/clone-settings/lib/schemas/clone-settings.schema";
import { TonePresetSelect } from "@/features/clone-settings/components/tone-preset-select";
import { CharCounterTextarea } from "@/features/clone-settings/components/char-counter-textarea";
import { ClearAllDialog } from "@/features/clone-settings/components/clear-all-dialog";

export function CloneSettingsPanel() {
  const currentProfile = useQuery(api.users.queries.getCurrentProfile);
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
    values: currentProfile
      ? {
        personaPrompt: currentProfile.personaPrompt ?? null,
        topicsToAvoid: currentProfile.topicsToAvoid ?? null,
        tonePreset:
          (currentProfile.tonePreset as TonePreset | null | undefined) ?? null,
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

  const onSubmit = useCallback(
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

  const handleClearAll = useCallback(async () => {
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

  return (
    <div
      data-testid="clone-settings-panel"
      className="p-4 mx-auto"
    >
      <h2 className="text-lg font-semibold mb-1">Clone settings</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Customize how your AI clone speaks.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="tonePreset"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tone preset</FormLabel>
                <FormControl>
                  <TonePresetSelect
                    value={field.value as TonePreset | null}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="personaPrompt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Core persona</FormLabel>
                <FormControl>
                  <CharCounterTextarea
                    value={field.value}
                    onChange={field.onChange}
                    maxLength={4000}
                    counterTestId="persona-prompt-counter"
                    placeholder="Describe how your clone should present itself..."
                    rows={6}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="topicsToAvoid"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topics to avoid</FormLabel>
                <FormControl>
                  <CharCounterTextarea
                    value={field.value}
                    onChange={field.onChange}
                    maxLength={500}
                    counterTestId="topics-to-avoid-counter"
                    placeholder="List topics your clone should not discuss..."
                    rows={3}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex items-center justify-between">
            <ClearAllDialog onConfirm={handleClearAll} />
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
