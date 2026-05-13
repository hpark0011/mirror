import { z } from "zod";

/**
 * Contact entry form schema.
 *
 * Kind-discriminated validation:
 *  - `email`: must be a valid email address.
 *  - All others: must be a syntactically valid URL that uses `https://`.
 *    `http://` and other protocols are rejected — same posture bio takes
 *    for user-supplied links.
 *
 * The `value` payload is trimmed at the mutation boundary
 * (`packages/convex/convex/contacts/mutations.ts:validateValue`); the client
 * Zod refinement does not pre-trim so the user can still see whitespace they
 * typed (and the error message it would cause).
 */

export const contactEntryKindSchema = z.enum([
  "email",
  "linkedin",
  "instagram",
  "x",
  "tiktok",
  "youtube",
]);

const emailValueSchema = z
  .string()
  .min(1, "Email is required")
  .email("Enter a valid email address");

const urlValueSchema = z
  .string()
  .min(1, "URL is required")
  .url("Enter a valid URL")
  .refine((v) => v.startsWith("https://"), {
    message: "URL must use https://",
  });

export const contactEntrySchema = z
  .object({
    kind: contactEntryKindSchema,
    value: z.string(),
  })
  .superRefine((data, ctx) => {
    const trimmed = data.value.trim();
    const schema = data.kind === "email" ? emailValueSchema : urlValueSchema;
    const result = schema.safeParse(trimmed);
    if (!result.success) {
      for (const issue of result.error.issues) {
        ctx.addIssue({
          ...issue,
          path: ["value"],
        });
      }
    }
  });

export type ContactEntryFormValues = z.infer<typeof contactEntrySchema>;
