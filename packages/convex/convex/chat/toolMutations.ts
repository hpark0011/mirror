import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, type MutationCtx } from "../_generated/server";
import { type Id } from "../_generated/dataModel";
import { isOwnedByUser } from "../content/helpers";
import { contentStatusValidator } from "../content/schema";
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
import {
  buildBioHref,
  buildContactHref,
  buildContentEditHref,
  buildContentHref,
  buildProfileSectionHref,
  buildProjectsHref,
} from "../content/href";
import { navigableContentKindValidator } from "../content/sourceValidators";
import { type NavigableContentKind } from "../content/sourceRegistry";
import {
  agentBlocksToTiptapDoc,
  type AgentContentBlock,
} from "../content/agentBody";
import {
  createArticleForUser,
  deleteArticleForUserBySlug,
  updateArticleForUserBySlug,
} from "../articles/writeHelpers";
import {
  createPostForUser,
  deletePostForUserBySlug,
  updatePostForUserBySlug,
} from "../posts/writeHelpers";
import {
  cleanupDeferredProjectCoverBlobs,
  createProjectForUser,
  removeProjectForUser,
  updateProjectForUser,
} from "../projects/writeHelpers";

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

const projectPatchOperationValidator = v.union(
  v.object({
    action: v.literal("create"),
    title: v.string(),
    startDate: monthDateValidator,
    endDate: v.union(monthDateValidator, v.null()),
    description: optionalTextPatchValidator,
    link: optionalTextPatchValidator,
    coverImageStorageId: v.optional(v.id("_storage")),
    coverImageThumbhash: v.optional(v.string()),
  }),
  v.object({
    action: v.literal("update"),
    id: v.id("projects"),
    title: v.optional(v.string()),
    startDate: v.optional(monthDateValidator),
    endDate: v.optional(v.union(monthDateValidator, v.null())),
    description: optionalTextPatchValidator,
    link: optionalTextPatchValidator,
    coverImageStorageId: v.optional(v.id("_storage")),
    coverImageThumbhash: v.optional(v.string()),
    clearCover: v.optional(v.boolean()),
  }),
  v.object({
    action: v.literal("delete"),
    id: v.id("projects"),
  }),
);

const projectPatchReturnValidator = v.object({
  section: v.literal("projects"),
  href: v.string(),
  applied: v.object({
    created: v.number(),
    updated: v.number(),
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
    return await deleteArticleForUserBySlug(ctx, args.userId, args.slug);
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

export const applyProjectPatch = internalMutation({
  args: {
    userId: v.id("users"),
    operations: v.array(projectPatchOperationValidator),
  },
  returns: projectPatchReturnValidator,
  handler: async (ctx, args) => {
    const owner = await ctx.db.get(args.userId);
    if (!owner?.username) {
      throw new Error("Projects panel is unavailable for this profile.");
    }

    let created = 0;
    let updated = 0;
    let deleted = 0;
    const deferredCoverBlobDeletions: Array<Id<"_storage">> = [];

    for (const operation of args.operations) {
      if (operation.action === "create") {
        await createProjectForUser(ctx, args.userId, {
          title: operation.title,
          startDate: toMonthTimestamp(operation.startDate),
          endDate:
            operation.endDate === null
              ? null
              : toMonthTimestamp(operation.endDate),
          description: operation.description,
          link: operation.link,
          coverImageStorageId: operation.coverImageStorageId,
          coverImageThumbhash: operation.coverImageThumbhash,
        });
        created += 1;
        continue;
      }

      if (operation.action === "update") {
        await updateProjectForUser(
          ctx,
          args.userId,
          {
            id: operation.id,
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
            coverImageStorageId: operation.coverImageStorageId,
            coverImageThumbhash: operation.coverImageThumbhash,
            clearCover: operation.clearCover,
          },
          { deferCoverBlobDeletion: deferredCoverBlobDeletions },
        );
        updated += 1;
        continue;
      }

      await removeProjectForUser(ctx, args.userId, operation.id, {
        deferCoverBlobDeletion: deferredCoverBlobDeletions,
      });
      deleted += 1;
    }

    await cleanupDeferredProjectCoverBlobs(ctx, deferredCoverBlobDeletions);

    return {
      section: "projects" as const,
      href: buildProjectsHref(owner.username),
      applied: { created, updated, deleted },
    };
  },
});

// PLAN_013: configuration agent content-authoring mutation.
//
// All operations apply in one Convex mutation transaction — Convex
// auto-rolls back the entire write set if any single operation throws,
// so a multi-op patch is all-or-nothing for slug collisions, body
// validation, and ownership errors. Missing rows on delete return
// `{ deleted: false }` instead of throwing; the agent surfaces that
// to the owner in text.
//
// Two-phase execution (creates/updates first, deletes last):
// `deletePost/ArticleForUserBySlug` invokes `ctx.storage.delete()` for
// cover blobs and inline images. `ctx.db.*` writes participate in the
// Convex transaction, but `ctx.storage.delete()` does NOT — once a
// blob is removed it stays removed even if the mutation later throws
// and rolls back the DB. Running all creates/updates first means any
// validation throw (body, slug collision, length) happens BEFORE any
// row's storage is destroyed; the rolled-back doc never ends up
// pointing at missing media. The trade-off: "delete A then create
// same-slug A" within one call no longer works — agents must rename
// via the `update` action's `newSlug` or split into two calls.
//
// Cross-user isolation: `userId` is the closure-bound `profileOwnerId`
// from `chat/configurationTools.ts`, never client-supplied. The
// LLM-visible `inputSchema` carries only `operations` (no user id, no
// viewer id). See `.claude/rules/agent-parity.md`.

const agentBodyBlockValidator = v.union(
  v.object({ type: v.literal("paragraph"), text: v.string() }),
  v.object({
    type: v.literal("heading"),
    level: v.union(v.literal(2), v.literal(3)),
    text: v.string(),
  }),
  v.object({
    type: v.literal("bulletList"),
    items: v.array(v.string()),
  }),
);

const contentPatchOperationValidator = v.union(
  v.object({
    action: v.literal("create"),
    kind: navigableContentKindValidator,
    title: v.string(),
    slug: v.optional(v.string()),
    category: v.string(),
    status: v.optional(contentStatusValidator),
    bodyBlocks: v.array(agentBodyBlockValidator),
  }),
  v.object({
    action: v.literal("update"),
    kind: navigableContentKindValidator,
    slug: v.string(),
    title: v.optional(v.string()),
    newSlug: v.optional(v.string()),
    category: v.optional(v.string()),
    status: v.optional(contentStatusValidator),
    bodyBlocks: v.optional(v.array(agentBodyBlockValidator)),
  }),
  v.object({
    action: v.literal("delete"),
    kind: navigableContentKindValidator,
    slug: v.string(),
  }),
);

const contentPatchResultValidator = v.union(
  v.object({
    action: v.union(v.literal("create"), v.literal("update")),
    kind: navigableContentKindValidator,
    slug: v.string(),
    status: contentStatusValidator,
    href: v.string(),
    editHref: v.string(),
  }),
  v.object({
    action: v.literal("delete"),
    kind: navigableContentKindValidator,
    slug: v.string(),
    deleted: v.boolean(),
    href: v.string(),
  }),
);

const contentPatchReturnValidator = v.object({
  results: v.array(contentPatchResultValidator),
  applied: v.object({
    created: v.number(),
    updated: v.number(),
    deleted: v.number(),
  }),
  lastTouched: v.union(
    v.null(),
    v.object({
      kind: navigableContentKindValidator,
      slug: v.string(),
      status: contentStatusValidator,
      href: v.string(),
      editHref: v.string(),
      action: v.union(v.literal("create"), v.literal("update")),
    }),
  ),
  lastDeleted: v.union(
    v.null(),
    v.object({
      kind: navigableContentKindValidator,
      slug: v.string(),
      href: v.string(),
    }),
  ),
});

type ContentPatchOperation =
  | {
      action: "create";
      kind: NavigableContentKind;
      title: string;
      slug?: string;
      category: string;
      status?: "draft" | "published";
      bodyBlocks: AgentContentBlock[];
    }
  | {
      action: "update";
      kind: NavigableContentKind;
      slug: string;
      title?: string;
      newSlug?: string;
      category?: string;
      status?: "draft" | "published";
      bodyBlocks?: AgentContentBlock[];
    }
  | {
      action: "delete";
      kind: NavigableContentKind;
      slug: string;
    };

const APPLY_CONTENT_PATCH_MAX_OPERATIONS = 5;

export const applyContentPatch = internalMutation({
  args: {
    userId: v.id("users"),
    operations: v.array(contentPatchOperationValidator),
  },
  returns: contentPatchReturnValidator,
  handler: async (ctx, args) => {
    if (args.operations.length === 0) {
      throw new Error("applyContentPatch requires at least one operation.");
    }
    if (args.operations.length > APPLY_CONTENT_PATCH_MAX_OPERATIONS) {
      throw new Error(
        `applyContentPatch supports at most ${APPLY_CONTENT_PATCH_MAX_OPERATIONS} operations per call.`,
      );
    }

    const owner = await ctx.db.get(args.userId);
    if (!owner?.username) {
      throw new Error("Content is unavailable for this profile.");
    }
    const username = owner.username;

    type CreateOrUpdateResult = {
      action: "create" | "update";
      kind: NavigableContentKind;
      slug: string;
      status: "draft" | "published";
      href: string;
      editHref: string;
    };
    type DeleteResult = {
      action: "delete";
      kind: NavigableContentKind;
      slug: string;
      deleted: boolean;
      href: string;
    };
    type OpResult = CreateOrUpdateResult | DeleteResult;

    // Index-aligned so the returned `results` array preserves the caller's
    // op order even though execution is reordered (deletes run last).
    const results: Array<OpResult | undefined> = new Array(
      args.operations.length,
    );

    let created = 0;
    let updated = 0;
    let deleted = 0;

    let lastTouched: {
      kind: NavigableContentKind;
      slug: string;
      status: "draft" | "published";
      href: string;
      editHref: string;
      action: "create" | "update";
    } | null = null;
    let lastDeleted: {
      kind: NavigableContentKind;
      slug: string;
      href: string;
    } | null = null;

    const ops = args.operations as ContentPatchOperation[];
    const deleteIndexes: number[] = [];

    // Pass 1 — creates and updates. Every throwable validation (body,
    // slug collision, ownership) runs here, before any storage cleanup.
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (op.action === "delete") {
        deleteIndexes.push(i);
        continue;
      }

      if (op.action === "create") {
        const body = agentBlocksToTiptapDoc(op.bodyBlocks);
        const status = op.status ?? "draft";

        // Destructure the persisted slug directly from the writeHelper return —
        // do NOT re-derive it here. The writeHelper is the single normalization
        // boundary (.claude/rules/identifiers.md rule 1).
        const { slug } =
          op.kind === "posts"
            ? await createPostForUser(ctx, args.userId, {
                title: op.title,
                slug: op.slug,
                category: op.category,
                body,
                status,
              })
            : await createArticleForUser(ctx, args.userId, {
                title: op.title,
                slug: op.slug,
                category: op.category,
                body,
                status,
              });

        const href = buildContentHref(username, op.kind, slug);
        const editHref = buildContentEditHref(username, op.kind, slug);
        results[i] = {
          action: "create",
          kind: op.kind,
          slug,
          status,
          href,
          editHref,
        };
        created += 1;
        lastTouched = {
          kind: op.kind,
          slug,
          status,
          href,
          editHref,
          action: "create",
        };
        continue;
      }

      // op.action === "update"
      const body =
        op.bodyBlocks !== undefined
          ? agentBlocksToTiptapDoc(op.bodyBlocks)
          : undefined;

      const updateResult =
        op.kind === "posts"
          ? await updatePostForUserBySlug(ctx, args.userId, op.slug, {
              title: op.title,
              slug: op.newSlug,
              category: op.category,
              body,
              status: op.status,
            })
          : await updateArticleForUserBySlug(ctx, args.userId, op.slug, {
              title: op.title,
              slug: op.newSlug,
              category: op.category,
              body,
              status: op.status,
            });

      const href = buildContentHref(username, op.kind, updateResult.slug);
      const editHref = buildContentEditHref(
        username,
        op.kind,
        updateResult.slug,
      );
      results[i] = {
        action: "update",
        kind: op.kind,
        slug: updateResult.slug,
        status: updateResult.status,
        href,
        editHref,
      };
      updated += 1;
      lastTouched = {
        kind: op.kind,
        slug: updateResult.slug,
        status: updateResult.status,
        href,
        editHref,
        action: "update",
      };
    }

    // Pass 2 — deletes, after every create/update validation has passed.
    // These call `ctx.storage.delete()` (non-transactional); deferring
    // them until now ensures a rolled-back row never points at missing
    // media.
    for (const i of deleteIndexes) {
      const op = ops[i] as Extract<ContentPatchOperation, { action: "delete" }>;
      const deleteResult =
        op.kind === "posts"
          ? await deletePostForUserBySlug(ctx, args.userId, op.slug)
          : await deleteArticleForUserBySlug(ctx, args.userId, op.slug);

      const sectionHref = buildProfileSectionHref(username, op.kind);
      results[i] = {
        action: "delete",
        kind: op.kind,
        slug: deleteResult.slug,
        deleted: deleteResult.deleted,
        href: sectionHref,
      };
      if (deleteResult.deleted) deleted += 1;
      if (deleteResult.deleted) {
        lastDeleted = {
          kind: op.kind,
          slug: deleteResult.slug,
          href: sectionHref,
        };
      }
    }

    return {
      results: results as OpResult[],
      applied: { created, updated, deleted },
      lastTouched,
      lastDeleted,
    };
  },
});
