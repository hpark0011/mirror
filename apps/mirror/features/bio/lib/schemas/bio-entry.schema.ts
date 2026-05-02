import { z } from "zod";

/**
 * Bio entry form schema.
 *
 * Notes (per spec, FR-03 + edge cases):
 * - `title` is 1–200 chars after trim.
 * - `description` and `link` are submitted as `""` when cleared (NOT `undefined`)
 *   so the Convex `update` mutation's `args.X !== undefined` patch contract
 *   actually clears the field. The serializer at
 *   `packages/convex/convex/bio/serializeForEmbedding.ts` trims and skips
 *   empties, so `""` is the safe contract.
 * - `link` is **https-only** (m10): empty string OR a valid URL that starts
 *   with `https://`.
 * - Year range: `1900 <= year <= currentYear + 1` — allows announcing roles
 *   starting next year, rejects pre-1900 typos.
 * - `endDate` may be `null` (= "Present"); when present must be `>= startDate`.
 */

export const bioEntryKindSchema = z.enum(["work", "education"]);

const MIN_YEAR = 1900;
const MONTH_MIN = 1;
const MONTH_MAX = 12;

function getMaxYear(): number {
  return new Date().getUTCFullYear() + 1;
}

const monthSchema = z
  .number()
  .int()
  .min(MONTH_MIN, "Month is required")
  .max(MONTH_MAX, "Month is required");

const yearSchema = z
  .number()
  .int()
  .min(MIN_YEAR, `Year must be ${MIN_YEAR} or later`)
  .refine((y) => y <= getMaxYear(), {
    message: "Year is too far in the future",
  });

const linkSchema = z
  .string()
  .url("Link must be a valid URL")
  .refine((v) => v === "" || v.startsWith("https://"), {
    message: "Link must use https://",
  })
  .or(z.literal(""));

export const bioEntrySchema = z
  .object({
    kind: bioEntryKindSchema,
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(200, "Title must be 200 characters or fewer"),
    startMonth: monthSchema,
    startYear: yearSchema,
    // `null` end means "Present" (current role / ongoing study).
    endMonth: monthSchema.nullable(),
    endYear: yearSchema.nullable(),
    description: z
      .string()
      .max(500, "Description must be 500 characters or fewer"),
    link: linkSchema,
  })
  .superRefine((data, ctx) => {
    const endMonthSet = data.endMonth !== null;
    const endYearSet = data.endYear !== null;
    if (endMonthSet !== endYearSet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End month and year must both be set, or both be empty",
        path: ["endYear"],
      });
      return;
    }
    if (!endMonthSet || !endYearSet) return;

    const startKey = data.startYear * 12 + (data.startMonth - 1);
    const endKey = (data.endYear ?? 0) * 12 + ((data.endMonth ?? 1) - 1);
    if (endKey < startKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after start date",
        path: ["endYear"],
      });
    }
  });

export type BioEntryFormValues = z.infer<typeof bioEntrySchema>;
