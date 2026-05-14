// User-scoped write helpers for the `articles` table.
//
// Originally the validation + DB write core lived inline in the public
// `authMutation`s in `articles/mutations.ts`. Configuration-mode agent
// content authoring (PLAN_013) needs to call the same core from
// `internalMutation`s that derive `profileOwnerId` server-side from the
// chat conversation, so the helpers were lifted here. Public mutations
// resolve `appUser` via `getAppUser` and call into the helpers; the chat
// agent's `applyContentPatch` does the same with its closure-bound owner
// id.
//
// Invariants preserved verbatim from `articles/mutations.ts`:
//
//   - Slug normalization happens at the mutation boundary via
//     `generateSlug` + `assertValidSlug` (`.claude/rules/identifiers.md`).
//   - External image src bodies are rejected (FG_148).
//   - Cover blob ownership is verified before the row is written
//     (FG_147 / PLAN_010).
//   - Inline image storageIds are claimed first-commit-wins (FG_091).
//   - Cover blob diff cascades through `deleteCoverBlobAndOwnership`.
//   - Inline image cleanup runs the caller-owned + unreferenced filter
//     and caps per invocation at `MAX_INLINE_DELETES_PER_INVOCATION`.
//   - Embedding schedule fires only on `status === "published"` writes;
//     status-flip to draft removes embeddings.
//
// The agent path supplies text-only `bodyBlocks` and never any cover or
// thumbhash arg, so the cover-handling branches are no-ops on that path.

import { ConvexError } from "convex/values";
import { type Doc, type Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { type MutationCtx } from "../_generated/server";
import { isOwnedByUser, validateContentStringLength } from "../content/helpers";
import { assertValidSlug, generateSlug } from "../content/slug";
import {
  MAX_CATEGORY_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_TITLE_LENGTH,
} from "../content/schema";
import { validateThumbhashFormat } from "./helpers";
import {
  extractInlineImageStorageIds,
  hasExternalImageSrcs,
  multisetDifference,
  type JSONContent,
} from "../content/bodyWalk";
import {
  claimInlineImageOwnership,
  filterCallerOwnedInlineIds,
  filterUnreferencedStorageIds,
} from "../content/inlineImageOwnership";
import {
  assertCoverBlobOwnership,
  deleteCoverBlobAndOwnership,
} from "../content/coverBlobOwnership";
import { MAX_INLINE_DELETES_PER_INVOCATION } from "../content/storagePolicy";

type ArticlePatch = Partial<
  Omit<Doc<"articles">, "_id" | "_creationTime" | "userId" | "createdAt">
>;

type ContentStatus = "draft" | "published";

export type CreateArticleArgs = {
  title: string;
  slug?: string;
  category: string;
  body: JSONContent;
  status: ContentStatus;
  coverImageStorageId?: Id<"_storage">;
  coverImageThumbhash?: string;
  coverVideoStorageId?: Id<"_storage">;
  coverVideoPosterStorageId?: Id<"_storage">;
};

export async function createArticleForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: CreateArticleArgs,
): Promise<{ id: Id<"articles">; slug: string }> {
  validateContentStringLength(args.title, "Title", MAX_TITLE_LENGTH);
  validateContentStringLength(args.category, "Category", MAX_CATEGORY_LENGTH);
  if (args.coverImageThumbhash !== undefined) {
    validateThumbhashFormat(args.coverImageThumbhash);
  }

  if (
    args.coverImageStorageId !== undefined &&
    args.coverVideoStorageId !== undefined
  ) {
    throw new ConvexError(
      "cover image and cover video are mutually exclusive — supply at most one",
    );
  }
  if (
    args.coverVideoStorageId !== undefined &&
    args.coverVideoPosterStorageId === undefined
  ) {
    throw new ConvexError("cover video requires a sibling poster storage id");
  }
  if (
    args.coverVideoPosterStorageId !== undefined &&
    args.coverVideoStorageId === undefined
  ) {
    throw new ConvexError(
      "cover video poster requires a sibling cover video storage id",
    );
  }

  // Empty-string slug is treated as "not supplied" (F5 — see
  // articles/__tests__/mutations.test.ts). Map "" → undefined so the
  // canonical `??` form below picks the title fallback.
  const providedSlug = args.slug?.trim() ? args.slug : undefined;
  const slug = generateSlug(providedSlug ?? args.title);
  validateContentStringLength(slug, "Slug", MAX_SLUG_LENGTH);
  assertValidSlug(slug);

  const existing = await ctx.db
    .query("articles")
    .withIndex("by_userId_and_slug", (q) =>
      q.eq("userId", userId).eq("slug", slug),
    )
    .unique();
  if (existing) {
    throw new Error(`An article with slug "${slug}" already exists`);
  }

  if (hasExternalImageSrcs(args.body)) {
    throw new ConvexError(
      "body contains image nodes with external src URLs; use the storage upload flow",
    );
  }

  if (args.coverImageStorageId !== undefined) {
    await assertCoverBlobOwnership(
      ctx,
      args.coverImageStorageId,
      userId,
      "image",
    );
  }
  if (args.coverVideoStorageId !== undefined) {
    await assertCoverBlobOwnership(
      ctx,
      args.coverVideoStorageId,
      userId,
      "video",
    );
  }
  if (args.coverVideoPosterStorageId !== undefined) {
    await assertCoverBlobOwnership(
      ctx,
      args.coverVideoPosterStorageId,
      userId,
      "poster",
    );
  }

  const now = Date.now();
  const articleId = await ctx.db.insert("articles", {
    userId,
    slug,
    title: args.title,
    category: args.category,
    body: args.body,
    status: args.status,
    coverImageStorageId: args.coverImageStorageId,
    coverImageThumbhash: args.coverImageThumbhash,
    coverVideoStorageId: args.coverVideoStorageId,
    coverVideoPosterStorageId: args.coverVideoPosterStorageId,
    createdAt: now,
    publishedAt: args.status === "published" ? now : undefined,
  });

  await claimInlineImageOwnership(ctx, args.body, userId);

  if (args.status === "published") {
    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.actions.generateEmbedding,
      { sourceTable: "articles" as const, sourceId: articleId },
    );
  }

  return { id: articleId, slug };
}

export type UpdateArticleArgs = {
  title?: string;
  slug?: string;
  category?: string;
  body?: JSONContent;
  status?: ContentStatus;
  coverImageStorageId?: Id<"_storage">;
  coverImageThumbhash?: string;
  coverVideoStorageId?: Id<"_storage">;
  coverVideoPosterStorageId?: Id<"_storage">;
  clearCover?: boolean;
};

export async function updateArticleForUserBySlug(
  ctx: MutationCtx,
  userId: Id<"users">,
  currentSlug: string,
  args: UpdateArticleArgs,
): Promise<{ id: Id<"articles">; slug: string; status: ContentStatus }> {
  const article = await ctx.db
    .query("articles")
    .withIndex("by_userId_and_slug", (q) =>
      q.eq("userId", userId).eq("slug", currentSlug),
    )
    .unique();
  if (!article) {
    throw new Error("Article not found");
  }
  if (!isOwnedByUser(article, userId)) {
    throw new Error("Not authorized to update this article");
  }

  return await updateArticleRow(ctx, userId, article, args);
}

export async function updateArticleForUserById(
  ctx: MutationCtx,
  userId: Id<"users">,
  id: Id<"articles">,
  args: UpdateArticleArgs,
): Promise<{ id: Id<"articles">; slug: string; status: ContentStatus }> {
  const article = await ctx.db.get(id);
  if (!article) {
    throw new Error("Article not found");
  }
  if (!isOwnedByUser(article, userId)) {
    throw new Error("Not authorized to update this article");
  }
  return await updateArticleRow(ctx, userId, article, args);
}

async function updateArticleRow(
  ctx: MutationCtx,
  userId: Id<"users">,
  article: Doc<"articles">,
  args: UpdateArticleArgs,
): Promise<{ id: Id<"articles">; slug: string; status: ContentStatus }> {
  if (args.title !== undefined) {
    validateContentStringLength(args.title, "Title", MAX_TITLE_LENGTH);
  }
  if (args.category !== undefined) {
    validateContentStringLength(args.category, "Category", MAX_CATEGORY_LENGTH);
  }
  if (args.coverImageThumbhash !== undefined) {
    validateThumbhashFormat(args.coverImageThumbhash);
  }

  let normalizedSlug: string | undefined;
  if (args.slug !== undefined && args.slug.trim() !== "") {
    normalizedSlug = generateSlug(args.slug);
    validateContentStringLength(normalizedSlug, "Slug", MAX_SLUG_LENGTH);
    assertValidSlug(normalizedSlug);
  }

  if (normalizedSlug && normalizedSlug !== article.slug) {
    const existing = await ctx.db
      .query("articles")
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", userId).eq("slug", normalizedSlug),
      )
      .unique();
    if (existing) {
      throw new Error(
        `An article with slug "${normalizedSlug}" already exists`,
      );
    }
  }

  if (args.body !== undefined && hasExternalImageSrcs(args.body)) {
    throw new ConvexError(
      "body contains image nodes with external src URLs; use the storage upload flow",
    );
  }

  if (
    args.coverImageStorageId !== undefined &&
    args.coverVideoStorageId !== undefined
  ) {
    throw new ConvexError(
      "cover image and cover video are mutually exclusive — supply at most one",
    );
  }
  if (
    args.coverVideoStorageId !== undefined &&
    args.coverVideoPosterStorageId === undefined
  ) {
    throw new ConvexError("cover video requires a sibling poster storage id");
  }
  if (
    args.coverVideoPosterStorageId !== undefined &&
    args.coverVideoStorageId === undefined
  ) {
    throw new ConvexError(
      "cover video poster requires a sibling cover video storage id",
    );
  }

  if (args.coverImageStorageId !== undefined) {
    await assertCoverBlobOwnership(
      ctx,
      args.coverImageStorageId,
      userId,
      "image",
    );
  }
  if (args.coverVideoStorageId !== undefined) {
    await assertCoverBlobOwnership(
      ctx,
      args.coverVideoStorageId,
      userId,
      "video",
    );
  }
  if (args.coverVideoPosterStorageId !== undefined) {
    await assertCoverBlobOwnership(
      ctx,
      args.coverVideoPosterStorageId,
      userId,
      "poster",
    );
  }

  const removedInlineIds: Id<"_storage">[] = (() => {
    if (args.body === undefined) return [];
    const oldIds = extractInlineImageStorageIds(article.body);
    const newIds = extractInlineImageStorageIds(args.body);
    const newSet = new Set(newIds);
    const diff = multisetDifference(oldIds, newIds).filter(
      (id) => !newSet.has(id),
    );
    return Array.from(new Set(diff)) as Id<"_storage">[];
  })();

  const patch: ArticlePatch = {};
  if (args.title !== undefined) patch.title = args.title;
  if (normalizedSlug !== undefined && normalizedSlug !== article.slug) {
    patch.slug = normalizedSlug;
  }
  if (args.category !== undefined) patch.category = args.category;
  if (args.body !== undefined) patch.body = args.body;

  let replacedImage = false;
  let replacedVideo = false;
  let replacedPoster = false;
  let clearedAllCover = false;

  if (args.clearCover === true) {
    patch.coverImageStorageId = undefined;
    patch.coverImageThumbhash = undefined;
    patch.coverVideoStorageId = undefined;
    patch.coverVideoPosterStorageId = undefined;
    clearedAllCover = true;
  } else if (
    args.coverVideoStorageId !== undefined &&
    (args.coverVideoStorageId !== article.coverVideoStorageId ||
      args.coverVideoPosterStorageId !== article.coverVideoPosterStorageId)
  ) {
    patch.coverVideoStorageId = args.coverVideoStorageId;
    patch.coverVideoPosterStorageId = args.coverVideoPosterStorageId;
    patch.coverImageStorageId = undefined;
    patch.coverImageThumbhash = undefined;
    replacedVideo = args.coverVideoStorageId !== article.coverVideoStorageId;
    replacedPoster =
      args.coverVideoPosterStorageId !== article.coverVideoPosterStorageId;
  } else if (
    args.coverImageStorageId !== undefined &&
    args.coverImageStorageId !== article.coverImageStorageId
  ) {
    patch.coverImageStorageId = args.coverImageStorageId;
    patch.coverImageThumbhash = args.coverImageThumbhash;
    patch.coverVideoStorageId = undefined;
    patch.coverVideoPosterStorageId = undefined;
    replacedImage = true;
  } else if (args.coverImageThumbhash !== undefined) {
    patch.coverImageThumbhash = args.coverImageThumbhash;
  }

  if (args.status !== undefined) {
    patch.status = args.status;
    if (args.status === "published" && !article.publishedAt) {
      patch.publishedAt = Date.now();
    }
  }

  await ctx.db.patch(article._id, patch);

  if (clearedAllCover || replacedVideo || replacedImage) {
    if (article.coverImageStorageId) {
      await deleteCoverBlobAndOwnership(ctx, article.coverImageStorageId);
    }
    if (article.coverVideoStorageId) {
      await deleteCoverBlobAndOwnership(ctx, article.coverVideoStorageId);
    }
  }
  if (clearedAllCover || replacedImage || replacedPoster) {
    if (article.coverVideoPosterStorageId) {
      await deleteCoverBlobAndOwnership(
        ctx,
        article.coverVideoPosterStorageId,
      );
    }
  }

  if (args.body !== undefined) {
    await claimInlineImageOwnership(ctx, args.body, userId);
  }

  const callerOwned = await filterCallerOwnedInlineIds(
    ctx,
    removedInlineIds,
    userId,
  );
  const toDelete = await filterUnreferencedStorageIds(
    ctx,
    callerOwned.slice(0, MAX_INLINE_DELETES_PER_INVOCATION),
  );
  for (const id of toDelete) {
    try {
      await ctx.storage.delete(id);
    } catch {
      // Ignore: the cron sweep is the safety net.
    }
  }

  const newStatus = args.status ?? article.status;
  if (newStatus === "published") {
    const contentChanged =
      args.title !== undefined ||
      args.body !== undefined ||
      args.status !== undefined;
    if (contentChanged) {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.actions.generateEmbedding,
        { sourceTable: "articles" as const, sourceId: article._id },
      );
    }
  } else if (args.status === "draft") {
    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.mutations.deleteBySource,
      { sourceTable: "articles" as const, sourceId: article._id },
    );
  }

  return {
    id: article._id,
    slug: patch.slug ?? article.slug,
    status: newStatus,
  };
}

export type DeleteArticleResult =
  | {
      deleted: true;
      title: string;
      slug: string;
    }
  | {
      deleted: false;
      slug: string;
    };

export async function deleteArticleForUserBySlug(
  ctx: MutationCtx,
  userId: Id<"users">,
  slug: string,
): Promise<DeleteArticleResult> {
  const article = await ctx.db
    .query("articles")
    .withIndex("by_userId_and_slug", (q) =>
      q.eq("userId", userId).eq("slug", slug),
    )
    .unique();
  if (!article || !isOwnedByUser(article, userId)) {
    return { deleted: false, slug };
  }
  await deleteArticleRow(ctx, userId, article);
  return { deleted: true, title: article.title, slug: article.slug };
}

export async function deleteArticleForUserById(
  ctx: MutationCtx,
  userId: Id<"users">,
  id: Id<"articles">,
): Promise<void> {
  const article = await ctx.db.get(id);
  if (!article || !isOwnedByUser(article, userId)) {
    return;
  }
  await deleteArticleRow(ctx, userId, article);
}

async function deleteArticleRow(
  ctx: MutationCtx,
  userId: Id<"users">,
  article: Doc<"articles">,
): Promise<void> {
  const inlineIds = Array.from(
    new Set(extractInlineImageStorageIds(article.body)),
  ) as Id<"_storage">[];

  await ctx.db.delete(article._id);

  await deleteCoverBlobAndOwnership(ctx, article.coverImageStorageId);
  await deleteCoverBlobAndOwnership(ctx, article.coverVideoStorageId);
  await deleteCoverBlobAndOwnership(ctx, article.coverVideoPosterStorageId);

  const callerOwned = await filterCallerOwnedInlineIds(ctx, inlineIds, userId);
  const inlineToDelete = await filterUnreferencedStorageIds(
    ctx,
    callerOwned.slice(0, MAX_INLINE_DELETES_PER_INVOCATION),
  );
  for (const id of inlineToDelete) {
    try {
      await ctx.storage.delete(id);
    } catch {
      // Ignore: the cron sweep is the safety net.
    }
  }

  await ctx.scheduler.runAfter(
    0,
    internal.embeddings.mutations.deleteBySource,
    { sourceTable: "articles" as const, sourceId: article._id },
  );
}
