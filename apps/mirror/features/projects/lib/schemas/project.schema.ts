import { z } from "zod";

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
  .refine((year) => year <= getMaxYear(), {
    message: "Year is too far in the future",
  });

const linkSchema = z
  .string()
  .url("Link must be a valid URL")
  .refine((value) => value === "" || value.startsWith("https://"), {
    message: "Link must use https://",
  })
  .or(z.literal(""));

export const projectSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(200, "Title must be 200 characters or fewer"),
    startMonth: monthSchema,
    startYear: yearSchema,
    endMonth: monthSchema.nullable(),
    endYear: yearSchema.nullable(),
    description: z
      .string()
      .max(500, "Description must be 500 characters or fewer"),
    link: linkSchema,
    coverImageStorageId: z.string().nullable(),
    coverImageThumbhash: z.string(),
    coverImageUrl: z.string().nullable(),
    clearCover: z.boolean(),
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

export type ProjectFormValues = z.infer<typeof projectSchema>;
