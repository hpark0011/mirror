import { defineTable } from "convex/server";
import { v } from "convex/values";
import { contentBaseFields, contentStatusValidator } from "../content/schema";

export const articleStatusValidator = contentStatusValidator;

export const articleFields = {
  ...contentBaseFields,
  // FG_150 (Option B): coverImageStorageId is intentionally decorative — no
  // alt/caption field exists and cover images are out of scope for the
  // embeddings/clone-agent context. The coverImageOwnership row (see
  // coverImageOwnershipTable below) tracks upload ownership separately.
  coverImageStorageId: v.optional(v.id("_storage")),
  coverImageThumbhash: v.optional(v.string()),
  category: v.string(),
};

export const articlesTable = defineTable(articleFields)
  .index("by_userId", ["userId"])
  .index("by_userId_and_slug", ["userId", "slug"])
  .index("by_userId_and_status", ["userId", "status"])
  .index("by_userId_status_publishedAt", ["userId", "status", "publishedAt"]);

// FG_147: ownership table for cover-image storage blobs.
//
// Mirrors the `inlineImageOwnership` pattern from FG_091.
// `generateArticleCoverImageUploadUrl` inserts a row here at upload-URL
// generation time. `create` and `update` look up the row by `storageId`
// and verify `userId` matches the calling user before writing
// `coverImageStorageId` to the article row.
//
// Args validators for mutations that write coverImageStorageId MUST NOT
// include a `userId` field — userId is always derived server-side from
// `getAppUser(ctx, ctx.user._id)`. See `.claude/rules/embeddings.md`.
//
// NOTE: This table is defined alongside the articles schema because
// cover-image ownership is article-specific (vs. `inlineImageOwnership`
// which is shared across articles and posts).
export const coverImageOwnershipFields = {
  storageId: v.id("_storage"),
  userId: v.id("users"),
  createdAt: v.number(),
};

export const coverImageOwnershipTable = defineTable(coverImageOwnershipFields)
  .index("by_storageId", ["storageId"])
  .index("by_userId_and_createdAt", ["userId", "createdAt"]);
