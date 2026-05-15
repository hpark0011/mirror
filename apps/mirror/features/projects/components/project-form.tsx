"use client";

import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@feel-good/ui/primitives/button";
import { Form } from "@feel-good/ui/primitives/form";
import {
  projectSchema,
  type ProjectFormValues,
} from "@/features/projects/lib/schemas/project.schema";
import { ProjectCoverField } from "@/features/projects/components/project-form-fields/project-cover-field";
import { ProjectMonthYearField } from "@/features/projects/components/project-form-fields/project-month-year-field";
import { ProjectTextFields } from "@/features/projects/components/project-form-fields/project-text-fields";

type ProjectFormProps = {
  defaultValues: ProjectFormValues;
  submitLabel: string;
  onSubmit: (values: ProjectFormValues) => void | Promise<void>;
  onCancel?: () => void;
};

export function ProjectForm({
  defaultValues,
  submitLabel,
  onSubmit,
  onCancel,
}: ProjectFormProps) {
  const { t } = useTranslation();
  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues,
    mode: "onChange",
    reValidateMode: "onChange",
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <ProjectCoverField watch={form.watch} setValue={form.setValue} />
        <ProjectTextFields control={form.control} />
        <ProjectMonthYearField
          control={form.control}
          monthName="startMonth"
          yearName="startYear"
          label={t("projects.form.startDate.label", { defaultValue: "Start" })}
          allowEmpty={false}
          required
        />
        <ProjectMonthYearField
          control={form.control}
          monthName="endMonth"
          yearName="endYear"
          label={t("projects.form.endDate.label", { defaultValue: "End" })}
          allowEmpty
        />

        <div className="flex items-center justify-end gap-1 pt-2">
          {onCancel ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="bg-dialog w-14"
              size="xs"
            >
              {t("projects.form.cancel", { defaultValue: "Cancel" })}
            </Button>
          ) : null}
          <Button type="submit" variant="primary" className="w-14" size="xs">
            {submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
