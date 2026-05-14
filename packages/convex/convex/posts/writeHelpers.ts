// User-scoped write helpers for the `posts` table.
//
// Mirrors `articles/writeHelpers.ts`. Originally the validation + DB write
// core lived inline in the public `authMutation`s in `posts/mutations.ts`.
// Configuration-mode agent content authoring (PLAN_013) needs to call the
// same core from `internalMutation`s that derive `profileOwnerId`
// server-side from the chat conversation, so the helpers were lifted here.
//
// Invariants preserved verbatim from `posts/mutations.ts` — see the
// articles helper file for the full list. Posts add one wrinkle vs.
// articles: a post's title may be empty (titleless posts) but a slug is
// still required because posts are route-addressed.

import { ConvexError } from "convex/values";
import { type Doc, type Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { type MutationCtx } from "../_generated/server";
import { isOwnedByUser, validateContentStringLength } from "../content/helpers";
import { assertValidSlug, generateSlug } from "../content/slug";
import { MAX_SLUG_LENGTH, MAX_TITLE_LENGTH } from "../content/schema";
import { validateThumbhashFormat } from "../articles/helpers";
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
import { MAX_POST_CATEGORY_LENGTH } from "./categories";

type PostPatch = Partial<
  Omit<Doc<"posts">, "_id" | "_creationTime" | "userId" | "createdAt">
>;

type ContentStatus = "draft" | "published";

export type CreatePostArgs = {
  title?: string;
  slug?: string;
  category: string;
  body: JSONContent;
  status: ContentStatus;
  coverImageStorageId?: Id<"_storage">;
  coverImageThumbhash?: string;
  coverVideoStorageId?: Id<"_storage">;
  coverVideoPosterStorageId?: Id<"_storage">;
};

export async function createPostForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: CreatePostArgs,
): Promise<Id<"posts">> {
  const title = args.title?.trim() ?? "";

  validateContentStringLength(title, "Title", MAX_TITLE_LENGTH);
  validateContentStringLength(
    args.category,
    "Category",
    MAX_POST_CATEGORY_LENGTH,
  );
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

  const slugSource = args.slug?.trim() ? args.slug : title;
  if (!slugSource.trim()) {
    throw new Error("Slug is required when title is empty");
  }
  const slug = generateSlug(slugSource);
  validateContentStringLength(slug, "Slug", MAX_SLUG_LENGTH);
  assertValidSlug(slug);

  const existing = await ctx.db
    .query("posts")
    .withIndex("by_userId_and_slug", (q) =>
      q.eq("userId", userId).eq("slug", slug),
    )
    .unique();
  if (existing) {
    throw new Error(`A post with slug "${slug}" already exists`);
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
  const postId = await ctx.db.insert("posts", {
    userId,
    slug,
    title,
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
      { sourceTable: "posts" as const, sourceId: postId },
    );
  }

  return postId;
}

export type UpdatePostArgs = {
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

export async function updatePostForUserBySlug(
  ctx: MutationCtx,
  userId: Id<"users">,
  currentSlug: string,
  args: UpdatePostArgs,
): Promise<{ id: Id<"posts">; slug: string; status: ContentStatus }> {
  const post = await ctx.db
    .query("posts")
    .withIndex("by_userId_and_slug", (q) =>
      q.eq("userId", userId).eq("slug", currentSlug),
    )
    .unique();
  if (!post) {
    throw new Error("Post not found");
  }
  if (!isOwnedByUser(post, userId)) {
    throw new Error("Not authorized to update this post");
  }
  return await updatePostRow(ctx, userId, post, args);
}

export async function updatePostForUserById(
  ctx: MutationCtx,
  userId: Id<"users">,
  id: Id<"posts">,
  args: UpdatePostArgs,
): Promise<{ id: Id<"posts">; slug: string; status: ContentStatus }> {
  const post = await ctx.db.get(id);
  if (!post) {
    throw new Error("Post not found");
  }
  if (!isOwnedByUser(post, userId)) {
    throw new Error("Not authorized to update this post");
  }
  return await updatePostRow(ctx, userId, post, args);
}

async function updatePostRow(
  ctx: MutationCtx,
  userId: Id<"users">,
  post: Doc<"posts">,
  args: UpdatePostArgs,
): Promise<{ id: Id<"posts">; slug: string; status: ContentStatus }> {
  const title = args.title === undefined ? undefined : args.title.trim();
  if (title !== undefined) {
    validateContentStringLength(title, "Title", MAX_TITLE_LENGTH);
  }
  if (args.category !== undefined) {
    validateContentStringLength(
      args.category,
      "Category",
      MAX_POST_CATEGORY_LENGTH,
    );
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

  if (normalizedSlug && normalizedSlug !== post.slug) {
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_userId_and_slug", (q) =>
        q.eq("userId", userId).eq("slug", normalizedSlug),
      )
      .unique();
    if (existing) {
      throw new Error(`A post with slug "${normalizedSlug}" already exists`);
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
    const oldIds = extractInlineImageStorageIds(post.body);
    const newIds = extractInlineImageStorageIds(args.body);
    const newSet = new Set(newIds);
    const diff = multisetDifference(oldIds, newIds).filter(
      (id) => !newSet.has(id),
    );
    return Array.from(new Set(diff)) as Id<"_storage">[];
  })();

  const patch: PostPatch = {};
  if (title !== undefined) patch.title = title;
  if (normalizedSlug !== undefined && normalizedSlug !== post.slug) {
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
    (args.coverVideoStorageId !== post.coverVideoStorageId ||
      args.coverVideoPosterStorageId !== post.coverVideoPosterStorageId)
  ) {
    patch.coverVideoStorageId = args.coverVideoStorageId;
    patch.coverVideoPosterStorageId = args.coverVideoPosterStorageId;
    patch.coverImageStorageId = undefined;
    patch.coverImageThumbhash = undefined;
    replacedVideo = args.coverVideoStorageId !== post.coverVideoStorageId;
    replacedPoster =
      args.coverVideoPosterStorageId !== post.coverVideoPosterStorageId;
  } else if (
    args.coverImageStorageId !== undefined &&
    args.coverImageStorageId !== post.coverImageStorageId
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
    if (args.status === "published" && !post.publishedAt) {
      patch.publishedAt = Date.now();
    }
  }

  await ctx.db.patch(post._id, patch);

  if (clearedAllCover || replacedVideo || replacedImage) {
    if (post.coverImageStorageId) {
      await deleteCoverBlobAndOwnership(ctx, post.coverImageStorageId);
    }
    if (post.coverVideoStorageId) {
      await deleteCoverBlobAndOwnership(ctx, post.coverVideoStorageId);
    }
  }
  if (clearedAllCover || replacedImage || replacedPoster) {
    if (post.coverVideoPosterStorageId) {
      await deleteCoverBlobAndOwnership(ctx, post.coverVideoPosterStorageId);
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

  const newStatus = args.status ?? post.status;
  if (newStatus === "published") {
    const contentChanged =
      args.title !== undefined ||
      args.body !== undefined ||
      args.status !== undefined;
    if (contentChanged) {
      await ctx.scheduler.runAfter(
        0,
        internal.embeddings.actions.generateEmbedding,
        { sourceTable: "posts" as const, sourceId: post._id },
      );
    }
  } else if (args.status === "draft") {
    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.mutations.deleteBySource,
      { sourceTable: "posts" as const, sourceId: post._id },
    );
  }

  return {
    id: post._id,
    slug: patch.slug ?? post.slug,
    status: newStatus,
  };
}

export type DeletePostResult =
  | { deleted: true; title: string; slug: string }
  | { deleted: false; slug: string };

export async function deletePostForUserBySlug(
  ctx: MutationCtx,
  userId: Id<"users">,
  slug: string,
): Promise<DeletePostResult> {
  const post = await ctx.db
    .query("posts")
    .withIndex("by_userId_and_slug", (q) =>
      q.eq("userId", userId).eq("slug", slug),
    )
    .unique();
  if (!post || !isOwnedByUser(post, userId)) {
    return { deleted: false, slug };
  }
  await deletePostRow(ctx, userId, post);
  return { deleted: true, title: post.title, slug: post.slug };
}

export async function deletePostForUserById(
  ctx: MutationCtx,
  userId: Id<"users">,
  id: Id<"posts">,
): Promise<void> {
  const post = await ctx.db.get(id);
  if (!post || !isOwnedByUser(post, userId)) {
    return;
  }
  await deletePostRow(ctx, userId, post);
}

async function deletePostRow(
  ctx: MutationCtx,
  userId: Id<"users">,
  post: Doc<"posts">,
): Promise<void> {
  const inlineIds = Array.from(
    new Set(extractInlineImageStorageIds(post.body)),
  ) as Id<"_storage">[];

  await ctx.db.delete(post._id);

  await deleteCoverBlobAndOwnership(ctx, post.coverImageStorageId);
  await deleteCoverBlobAndOwnership(ctx, post.coverVideoStorageId);
  await deleteCoverBlobAndOwnership(ctx, post.coverVideoPosterStorageId);

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
    { sourceTable: "posts" as const, sourceId: post._id },
  );
}
