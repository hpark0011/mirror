// Zod schema for the article metadata header. Status is the discriminated
// union the Convex mutations expect; slug is optional client-side because
// the server normalizes it from `slug ?? title` (per identifiers.md).
import { z } from "zod";
import {
  MAX_SLUG_LENGTH,
  MAX_TITLE_LENGTH,
} from "@feel-good/convex/convex/content/schema";

export const ARTICLE_STATUSES = ["draft", "published"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

const MAX_CATEGORY_LENGTH = 64;

export const articleMetadataSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(MAX_TITLE_LENGTH, `Title must be ${MAX_TITLE_LENGTH} characters or fewer`),
  slug: z
    .string()
    .trim()
    .max(MAX_SLUG_LENGTH, `Slug must be ${MAX_SLUG_LENGTH} characters or fewer`)
    .optional()
    .or(z.literal("")),
  category: z
    .string()
    .trim()
    .min(1, "Category is required")
    .max(
      MAX_CATEGORY_LENGTH,
      `Category must be ${MAX_CATEGORY_LENGTH} characters or fewer`,
    ),
  status: z.enum(ARTICLE_STATUSES),
});

export type ArticleMetadataFormData = z.infer<typeof articleMetadataSchema>;
