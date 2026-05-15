import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { type ProjectFormValues } from "../lib/schemas/project.schema";
import { monthYearToEpochMs } from "./month-year";

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
          coverImageStorageId:
            values.coverImageStorageId as Id<"_storage">,
          ...(values.coverImageThumbhash
            ? { coverImageThumbhash: values.coverImageThumbhash }
            : {}),
        }
      : {}),
    ...(values.clearCover ? { clearCover: true } : {}),
  };
}
