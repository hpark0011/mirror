import type { Doc } from "../_generated/dataModel";

export const DEFAULT_POST_CATEGORY = "Creativity";
export const MAX_POST_CATEGORY_LENGTH = 100;

const POST_CATEGORY_BY_SLUG: Record<string, string> = {
  "listening-before-speaking": "Attention",
  "the-body-knows-first": "Attention",
  "attention-is-the-gift": "Attention",
  "seasons-of-making": "Process",
  "doubt-as-compass": "Process",
  "rules-and-breaking-them": "Process",
  "remove-the-unnecessary": "Creativity",
  "the-source-is-everywhere": "Creativity",
  "make-the-room-safe": "Collaboration",
};

export function getPostCategoryForSlug(slug: string): string {
  return POST_CATEGORY_BY_SLUG[slug] ?? DEFAULT_POST_CATEGORY;
}

export function resolvePostCategory(
  post: Pick<Doc<"posts">, "slug"> & { category?: string },
): string {
  return post.category?.trim() || getPostCategoryForSlug(post.slug);
}
