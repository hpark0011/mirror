import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { isOwnedByUser } from "../content/helpers";
import { contentStatusValidator } from "../content/schema";
import { extractInlineImageStorageIds } from "../content/bodyWalk";
import {
  filterCallerOwnedInlineIds,
  filterUnreferencedStorageIds,
} from "../content/inlineImageOwnership";
import { MAX_INLINE_DELETES_PER_INVOCATION } from "../content/storagePolicy";
import { bioEntryKindValidator } from "../bio/schema";
import {
  createBioEntryForUser,
  removeBioEntryForUser,
  updateBioEntryForUser,
} from "../bio/writeHelpers";
import { contactEntryKindValidator } from "../contacts/schema";
import {
  removeContactEntryByKindForUser,
  upsertContactEntryForUser,
} from "../contacts/writeHelpers";
import { buildBioHref, buildContactHref } from "../content/href";

type ContentStatus = "draft" | "published";

const statusMutationReturnValidator = v.union(
  v.object({
    updated: v.literal(true),
    changed: v.boolean(),
    kind: v.union(v.literal("articles"), v.literal("posts")),
    slug: v.string(),
    title: v.string(),
    status: contentStatusValidator,
    previousStatus: contentStatusValidator,
    publishedAt: v.optional(v.number()),
  }),
  v.object({
    updated: v.literal(false),
    kind: v.union(v.literal("articles"), v.literal("posts")),
    slug: v.string(),
    status: contentStatusValidator,
  }),
);

const deleteArticleReturnValidator = v.union(
  v.object({
    deleted: v.literal(true),
    title: v.string(),
    slug: v.string(),
  }),
  v.object({
    deleted: v.literal(false),
    slug: v.string(),
  }),
);

const monthDateValidator = v.object({
  year: v.number(),
  month: v.optional(v.number()),
});

const optionalTextPatchValidator = v.optional(v.string());

const bioEntryPatchOperationValidator = v.union(
  v.object({
    action: v.literal("create"),
    kind: bioEntryKindValidator,
    title: v.string(),
    startDate: monthDateValidator,
    endDate: v.union(monthDateValidator, v.null()),
    description: optionalTextPatchValidator,
    link: optionalTextPatchValidator,
  }),
  v.object({
    action: v.literal("update"),
    id: v.id("bioEntries"),
    kind: v.optional(bioEntryKindValidator),
    title: v.optional(v.string()),
    startDate: v.optional(monthDateValidator),
    endDate: v.optional(v.union(monthDateValidator, v.null())),
    description: optionalTextPatchValidator,
    link: optionalTextPatchValidator,
  }),
  v.object({
    action: v.literal("delete"),
    id: v.id("bioEntries"),
  }),
);

const bioEntryPatchReturnValidator = v.object({
  section: v.literal("bio"),
  href: v.string(),
  applied: v.object({
    created: v.number(),
    updated: v.number(),
    deleted: v.number(),
  }),
});

const contactEntryPatchOperationValidator = v.union(
  v.object({
    action: v.literal("set"),
    kind: contactEntryKindValidator,
    value: v.string(),
  }),
  v.object({
    action: v.literal("delete"),
    kind: contactEntryKindValidator,
  }),
);

const contactEntryPatchReturnValidator = v.object({
  section: v.literal("contact"),
  href: v.string(),
  applied: v.object({
    upserted: v.number(),
    deleted: v.number(),
  }),
});

async function setStatusForPost(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    slug: string;
    status: ContentStatus;
  },
) {
  const post = await ctx.db
    .query("posts")
    .withIndex("by_userId_and_slug", (q) =>
      q.eq("userId", args.userId).eq("slug", args.slug),
    )
    .unique();

  if (!post || !isOwnedByUser(post, args.userId)) {
    return {
      updated: false as const,
      kind: "posts" as const,
      slug: args.slug,
      status: args.status,
    };
  }

  const previousStatus = post.status;
  const changed = previousStatus !== args.status;
  let publishedAt = post.publishedAt;

  if (changed || (args.status === "published" && !publishedAt)) {
    const patch: {
      status: ContentStatus;
      publishedAt?: number;
    } = { status: args.status };
    if (args.status === "published" && !publishedAt) {
      publishedAt = Date.now();
      patch.publishedAt = publishedAt;
    }
    await ctx.db.patch(post._id, patch);
  }

  if (changed) {
    if (args.status === "published") {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.actions.generateEmbedding,
        { sourceTable: "posts" as const, sourceId: post._id },
      );
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.mutations.deleteBySource,
        { sourceTable: "posts" as const, sourceId: post._id },
      );
    }
  }

  return {
    updated: true as const,
    changed,
    kind: "posts" as const,
    slug: post.slug,
    title: post.title,
    status: args.status,
    previousStatus,
    publishedAt,
  };
}

function toMonthTimestamp(date: { year: number; month?: number }): number {
  if (!Number.isInteger(date.year) || date.year < 1900 || date.year > 3000) {
    throw new Error("year must be between 1900 and 3000");
  }
  const month = date.month ?? 1;
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("month must be between 1 and 12");
  }
  return Date.UTC(date.year, month - 1, 1);
}

async function setStatusForArticle(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    slug: string;
    status: ContentStatus;
  },
) {
  const article = await ctx.db
    .query("articles")
    .withIndex("by_userId_and_slug", (q) =>
      q.eq("userId", args.userId).eq("slug", args.slug),
    )
    .unique();

  if (!article || !isOwnedByUser(article, args.userId)) {
    return {
      updated: false as const,
      kind: "articles" as const,
      slug: args.slug,
      status: args.status,
    };
  }

  const previousStatus = article.status;
  const changed = previousStatus !== args.status;
  let publishedAt = article.publishedAt;

  if (changed || (args.status === "published" && !publishedAt)) {
    const patch: {
      status: ContentStatus;
      publishedAt?: number;
    } = { status: args.status };
    if (args.status === "published" && !publishedAt) {
      publishedAt = Date.now();
      patch.publishedAt = publishedAt;
    }
    await ctx.db.patch(article._id, patch);
  }

  if (changed) {
    if (args.status === "published") {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.actions.generateEmbedding,
        { sourceTable: "articles" as const, sourceId: article._id },
      );
    } else {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.mutations.deleteBySource,
        { sourceTable: "articles" as const, sourceId: article._id },
      );
    }
  }

  return {
    updated: true as const,
    changed,
    kind: "articles" as const,
    slug: article.slug,
    title: article.title,
    status: args.status,
    previousStatus,
    publishedAt,
  };
}

async function safeDeleteStorage(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
): Promise<boolean> {
  if (!storageId) return false;
  try {
    await ctx.storage.delete(storageId);
    return true;
  } catch (err) {
    console.error("[chat.toolMutations] ctx.storage.delete failed", err);
    return false;
  }
}

async function deleteCoverBlobOwnership(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
): Promise<void> {
  if (!storageId) return;
  const row = await ctx.db
    .query("coverImageOwnership")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .unique();
  if (row) {
    await ctx.db.delete(row._id);
  }
}

async function deleteCoverBlobAndOwnership(
  ctx: MutationCtx,
  storageId: Id<"_storage"> | undefined,
): Promise<void> {
  if (await safeDeleteStorage(ctx, storageId)) {
    await deleteCoverBlobOwnership(ctx, storageId);
  }
}

export const setPostStatusByUserAndSlug = internalMutation({
  args: {
    userId: v.id("users"),
    slug: v.string(),
    status: contentStatusValidator,
  },
  returns: statusMutationReturnValidator,
  handler: async (ctx, args) => {
    return await setStatusForPost(ctx, args);
  },
});

export const setArticleStatusByUserAndSlug = internalMutation({
  args: {
    userId: v.id("users"),
    slug: v.string(),
    status: contentStatusValidator,
  },
  returns: statusMutationReturnValidator,
  handler: async (ctx, args) => {
    return await setStatusForArticle(ctx, args);
  },
});

export const deleteArticleByUserAndSlug = internalMutation({
  args: {
    userId: v.id("users"),
    slug: v.string(),
  },
  returns: deleteArticleReturnValidator,
  handler: async (ctx, args) => {
    const article = await ctx.db
      .query("articles")
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", args.userId).eq("slug", args.slug),
      )
      .unique();

    if (!article || !isOwnedByUser(article, args.userId)) {
      return { deleted: false as const, slug: args.slug };
    }

    const inlineIds = Array.from(
      new Set(extractInlineImageStorageIds(article.body)),
    ) as Id<"_storage">[];

    await ctx.db.delete(article._id);

    await deleteCoverBlobAndOwnership(ctx, article.coverImageStorageId);
    await deleteCoverBlobAndOwnership(ctx, article.coverVideoStorageId);
    await deleteCoverBlobAndOwnership(ctx, article.coverVideoPosterStorageId);

    const callerOwned = await filterCallerOwnedInlineIds(
      ctx,
      inlineIds,
      args.userId,
    );
    const inlineToDelete = await filterUnreferencedStorageIds(
      ctx,
      callerOwned.slice(0, MAX_INLINE_DELETES_PER_INVOCATION),
    );
    for (const id of inlineToDelete) {
      await safeDeleteStorage(ctx, id);
    }

    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.mutations.deleteBySource,
      { sourceTable: "articles" as const, sourceId: article._id },
    );

    return {
      deleted: true as const,
      title: article.title,
      slug: article.slug,
    };
  },
});

export const applyBioEntryPatch = internalMutation({
  args: {
    userId: v.id("users"),
    operations: v.array(bioEntryPatchOperationValidator),
  },
  returns: bioEntryPatchReturnValidator,
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.userId);
    if (!owner?.username) {
      throw new Error("Bio panel is unavailable for this profile.");
    }

    let created = 0;
    let updated = 0;
    let deleted = 0;

    for (const operation of args.operations) {
      if (operation.action === "create") {
        await createBioEntryForUser(ctx, args.userId, {
          kind: operation.kind,
          title: operation.title,
          startDate: toMonthTimestamp(operation.startDate),
          endDate:
            operation.endDate === null
              ? null
              : toMonthTimestamp(operation.endDate),
          description: operation.description,
          link: operation.link,
        });
        created += 1;
        continue;
      }

      if (operation.action === "update") {
        await updateBioEntryForUser(ctx, args.userId, {
          id: operation.id,
          kind: operation.kind,
          title: operation.title,
          startDate: operation.startDate
            ? toMonthTimestamp(operation.startDate)
            : undefined,
          endDate:
            operation.endDate === undefined
              ? undefined
              : operation.endDate === null
                ? null
                : toMonthTimestamp(operation.endDate),
          description: operation.description,
          link: operation.link,
        });
        updated += 1;
        continue;
      }

      await removeBioEntryForUser(ctx, args.userId, operation.id);
      deleted += 1;
    }

    return {
      section: "bio" as const,
      href: buildBioHref(owner.username),
      applied: { created, updated, deleted },
    };
  },
});

export const applyContactEntryPatch = internalMutation({
  args: {
    userId: v.id("users"),
    operations: v.array(contactEntryPatchOperationValidator),
  },
  returns: contactEntryPatchReturnValidator,
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.userId);
    if (!owner?.username) {
      throw new Error("Contact panel is unavailable for this profile.");
    }

    let upserted = 0;
    let deleted = 0;

    for (const operation of args.operations) {
      if (operation.action === "set") {
        await upsertContactEntryForUser(ctx, args.userId, {
          kind: operation.kind,
          value: operation.value,
        });
        upserted += 1;
        continue;
      }

      if (
        await removeContactEntryByKindForUser(ctx, args.userId, operation.kind)
      ) {
        deleted += 1;
      }
    }

    return {
      section: "contact" as const,
      href: buildContactHref(owner.username),
      applied: { upserted, deleted },
    };
  },
});
