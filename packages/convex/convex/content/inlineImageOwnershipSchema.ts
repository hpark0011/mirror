// Schema for the `inlineImageOwnership` table.
//
// This table records which user "introduced" a given inline-image storage
// blob into a content body (article or post). It is the trust boundary for
// the inline-image cascade-delete in `articles.update`, `articles.remove`,
// `posts.update`, and `posts.remove`: those mutations only call
// `ctx.storage.delete(storageId)` for IDs that this table attributes to the
// caller.
//
// This file is intentionally named `inlineImageOwnershipSchema.ts` (NOT
// `schema.ts`) so the orphan-sweep schema-introspection regression test in
// `content/__tests__/orphan-sweep.test.ts` does NOT enumerate the
// `storageId` field here. The orphan sweep should NOT treat ownership rows
// as live references — an ownership row is metadata, not a referencing
// document. If we listed it in `STORAGE_FIELD_REFERENCES`, ownership rows
// would keep otherwise-orphaned blobs alive forever.
//
// Pure module: contains only schema definitions. No Convex function
// registrations.

import { defineTable } from "convex/server";
import { v } from "convex/values";

export const inlineImageOwnershipFields = {
  storageId: v.id("_storage"),
  userId: v.id("users"),
  createdAt: v.number(),
};

export const inlineImageOwnershipTable = defineTable(
  inlineImageOwnershipFields,
)
  .index("by_storageId", ["storageId"])
  .index("by_userId_and_createdAt", ["userId", "createdAt"]);
