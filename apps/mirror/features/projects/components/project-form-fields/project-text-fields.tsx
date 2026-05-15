"use client";

import { type Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@feel-good/ui/primitives/form";
import { Input } from "@feel-good/ui/primitives/input";
import { Textarea } from "@feel-good/ui/primitives/textarea";
import { type ProjectFormValues } from "@/features/projects/lib/schemas/project.schema";

type ProjectTextFieldsProps = {
  control: Control<ProjectFormValues>;
};

export function ProjectTextFields({ control }: ProjectTextFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <FormField
        control={control}
        name="title"
        render={({ field }) => (
          <FormItem className="flex">
            <FormLabel className="w-40 gap-0.5">
              {t("projects.form.title.label", { defaultValue: "Title" })}
              <span aria-hidden="true" className="text-destructive">
                *
              </span>
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={t("projects.form.title.placeholder", {
                  defaultValue: "Realtime analytics dashboard",
                })}
                autoComplete="off"
                size="sm"
                className="border-border-subtle dark:border-border px-1 focus-visible:bg-gray-4 focus-visible:rounded-md"
                variant="underline"
                data-testid="project-title-input"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="description"
        render={({ field }) => (
          <FormItem className="flex items-start py-4 pb-2">
            <FormLabel className="w-40 pt-1.5">
              {t("projects.form.description.label", {
                defaultValue: "Description",
              })}
            </FormLabel>
            <FormControl>
              <Textarea
                {...field}
                placeholder={t("projects.form.description.placeholder", {
                  defaultValue:
                    "Short description of the work, outcome, or current status.",
                })}
                className="border-border-subtle dark:border-border min-h-[120px] max-h-[120px] rounded-[10px] resize-none"
                data-testid="project-description-input"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="link"
        render={({ field }) => (
          <FormItem className="flex">
            <FormLabel className="w-40">
              {t("projects.form.link.label", { defaultValue: "Link" })}
            </FormLabel>
            <FormControl>
              <Input
                {...field}
                inputMode="url"
                placeholder={t("projects.form.link.placeholder", {
                  defaultValue: "https://example.com",
                })}
                autoComplete="off"
                className="border-border-subtle dark:border-border px-1 focus-visible:bg-gray-4 focus-visible:rounded-md"
                size="sm"
                variant="underline"
                data-testid="project-link-input"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
