"use client";

import { type TonePreset } from "@feel-good/convex/chat/tonePresets";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";
import { useCloneSettings } from "@/features/clone-settings/hooks/use-clone-settings";
import { TonePresetSelect } from "@/features/clone-settings/components/tone-preset-select";
import { CharCounterTextarea } from "@/features/clone-settings/components/char-counter-textarea";
import { ClearAllDialog } from "@/features/clone-settings/components/clear-all-dialog";
import { CloneSettingsToolbar } from "@/features/clone-settings/components/clone-settings-toolbar";

const CLONE_SETTINGS_FORM_ID = "clone-settings-form";

export function CloneSettingsPanel() {
  const { form, isPending, handleSubmit, handleClear } = useCloneSettings();

  return (
    <>
      <WorkspaceToolbar>
        <CloneSettingsToolbar
          formId={CLONE_SETTINGS_FORM_ID}
          isPending={isPending}
        />
      </WorkspaceToolbar>
      <div
        data-testid="clone-settings-panel"
        className="p-4 py-12 mx-auto w-full max-w-xl"
      >
        <p className="text-[15px] mb-4">
          Customize how your AI clone speaks.
        </p>
        <Form {...form}>
          <form
            id={CLONE_SETTINGS_FORM_ID}
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
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

            <div className="flex items-center">
              <ClearAllDialog onConfirm={handleClear} />
            </div>
          </form>
        </Form>
      </div>
    </>
  );
}
