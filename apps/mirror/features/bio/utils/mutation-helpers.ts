import { type BioEntry } from "../types";
import { type BioEntryFormValues } from "../lib/schemas/bio-entry.schema";
import { monthYearToEpochMs } from "./month-year";

/**
 * Maps RHF form values to the shape expected by the bio create/update Convex
 * mutations.
 *
 * Wave-1 patch contract: cleared optional fields submit `""` (NOT
 * `undefined`); the embedding serializer trims and skips empties.
 */
export function toMutationArgs(values: BioEntryFormValues): {
  kind: BioEntry["kind"];
  title: string;
  startDate: number;
  endDate: number | null;
  description: string;
  link: string;
} {
  return {
    kind: values.kind,
    title: values.title.trim(),
    startDate: monthYearToEpochMs(values.startMonth, values.startYear),
    endDate:
      values.endMonth !== null && values.endYear !== null
        ? monthYearToEpochMs(values.endMonth, values.endYear)
        : null,
    description: values.description,
    link: values.link,
  };
}

/**
 * Extracts a user-facing message from an unknown thrown value. Convex
 * `ConvexError`s are `Error` instances, so their `message` is preserved
 * (e.g. "Bio entry limit reached (50). ...").
 */
export function getMutationErrorMessage(err: unknown): string {
  return err instanceof Error
    ? err.message
    : "Something went wrong. Please try again.";
}
