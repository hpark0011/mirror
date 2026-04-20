import { z } from "zod";

/**
 * Client-side waitlist submission schema. Normalizes the email (trim +
 * lowercase) so the `by_email` index on the Convex side is always queried
 * against the canonical form. The server re-normalizes defensively in
 * `packages/convex/convex/waitlistRequests/mutations.ts::submit`.
 */
export const waitlistSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address."),
});

export type WaitlistFormValues = z.infer<typeof waitlistSchema>;
