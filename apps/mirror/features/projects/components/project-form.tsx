"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@feel-good/ui/primitives/button";
import { Form } from "@feel-good/ui/primitives/form";
import {
  projectSchema,
  type ProjectFormValues,
} from "../lib/schemas/project.schema";
import { ProjectCoverField } from "./project-form-fields/project-cover-field";
import { ProjectMonthYearField } from "./project-form-fields/project-month-year-field";
import { ProjectTextFields } from "./project-form-fields/project-text-fields";

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
          label="Start"
          allowEmpty={false}
          required
        />
        <ProjectMonthYearField
          control={form.control}
          monthName="endMonth"
          yearName="endYear"
          label="End"
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
              Cancel
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
