// Zod schema for the post metadata header. Status is the discriminated
// union the Convex mutations expect. Post titles may be blank, but a
// titleless post still needs an explicit slug because the detail route is
// slug-addressed.
//
// Mirrors `apps/mirror/features/articles/lib/schemas/article-metadata.schema.ts`
// but uses MAX_POST_CATEGORY_LENGTH (posts have their own category-length
// constant — see packages/convex/convex/posts/categories.ts).
import { z } from "zod";
import {
  MAX_SLUG_LENGTH,
  MAX_TITLE_LENGTH,
} from "@feel-good/convex/convex/content/schema";
import { MAX_POST_CATEGORY_LENGTH } from "@feel-good/convex/convex/posts/categories";

export const POST_STATUSES = ["draft", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const postMetadataSchema = z
  .object({
    title: z
      .string()
      .trim()
      .max(
        MAX_TITLE_LENGTH,
        `Title must be ${MAX_TITLE_LENGTH} characters or fewer`,
      ),
    slug: z
      .string()
      .trim()
      .max(
        MAX_SLUG_LENGTH,
        `Slug must be ${MAX_SLUG_LENGTH} characters or fewer`,
      )
      .optional()
      .or(z.literal("")),
    category: z
      .string()
      .trim()
      .min(1, "Category is required")
      .max(
        MAX_POST_CATEGORY_LENGTH,
        `Category must be ${MAX_POST_CATEGORY_LENGTH} characters or fewer`,
      ),
    status: z.enum(POST_STATUSES),
  })
  .superRefine((data, ctx) => {
    if (!data.title.trim() && !data.slug?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Slug is required when title is empty",
        path: ["slug"],
      });
    }
  });

export type PostMetadataFormData = z.infer<typeof postMetadataSchema>;
