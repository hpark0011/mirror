import { type ProjectFormValues } from "@/features/projects/lib/schemas/project.schema";
import { monthYearToEpochMs } from "@/features/projects/utils/month-year";

export function toMutationArgs(values: ProjectFormValues) {
  const endDate =
    values.endMonth === null || values.endYear === null
      ? null
      : monthYearToEpochMs(values.endMonth, values.endYear);

  return {
    title: values.title.trim(),
    startDate: monthYearToEpochMs(values.startMonth, values.startYear),
    endDate,
    description: values.description.trim(),
    link: values.link.trim(),
    ...(values.coverImageStorageId
      ? {
          coverImageStorageId: values.coverImageStorageId,
          ...(values.coverImageThumbhash
            ? { coverImageThumbhash: values.coverImageThumbhash }
            : {}),
        }
      : {}),
    ...(values.clearCover ? { clearCover: true } : {}),
  };
}
