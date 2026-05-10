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
  // PLAN_010: optional MP4 cover. Sibling to the image cover, not a
  // discriminated union — the image and video fields are mutually
  // exclusive at the mutation boundary (setting one clears the other),
  // but kept as separate optionals so the orphan-sweep registry can key
  // each blob on its own `<table>.<field>` and no migration is required
  // on existing rows. Render precedence: video wins when
  // `coverVideoStorageId` is set, otherwise the image cover (or none).
  // The poster blob is uploaded BEFORE the article row is written so
  // `<video poster={posterUrl}>` has something to show before metadata
  // loads.
  coverVideoStorageId: v.optional(v.id("_storage")),
  coverVideoPosterStorageId: v.optional(v.id("_storage")),
  category: v.string(),
};

export const articlesTable = defineTable(articleFields)
  .index("by_userId", ["userId"])
  .index("by_userId_and_slug", ["userId", "slug"])
  .index("by_userId_and_status", ["userId", "status"])
  .index("by_userId_status_publishedAt", ["userId", "status", "publishedAt"]);

// FG_147 / PLAN_010: ownership table for cover-blob uploads.
//
// Mirrors the `inlineImageOwnership` pattern from FG_091. The
// `generateArticleCover{Image,Video,VideoPoster}UploadUrl` mutations issue
// a presigned URL and the matching `claim…Ownership` mutation inserts a
// row here once the upload completes. `create` and `update` look up the
// row by `storageId` and verify `userId` matches the calling user before
// writing the storage reference onto the article row.
//
// Originally added for cover *images* under FG_147. Reused for the cover
// *video* and the auto-generated poster (PLAN_010 D1) — each blob gets
// its own ownership row keyed on its own storageId. The table name is
// preserved to avoid a migration; "cover-blob ownership" is the accurate
// concept now.
//
// Args validators for mutations that write any cover storageId MUST NOT
// include a `userId` field — userId is always derived server-side from
// `getAppUser(ctx, ctx.user._id)`. See `.claude/rules/embeddings.md`.
//
// NOTE: This table is defined alongside the articles schema because
// cover-blob ownership is article-specific (vs. `inlineImageOwnership`
// which is shared across articles and posts).
export const coverImageOwnershipFields = {
  storageId: v.id("_storage"),
  userId: v.id("users"),
  createdAt: v.number(),
  // FG_196 widen step: optional until the backfill runs and a follow-up
  // deploy can narrow this to required.
  kind: v.optional(
    v.union(v.literal("image"), v.literal("video"), v.literal("poster")),
  ),
};

export const coverImageOwnershipTable = defineTable(coverImageOwnershipFields)
  .index("by_storageId", ["storageId"])
  .index("by_userId_and_createdAt", ["userId", "createdAt"]);
