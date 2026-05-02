import { v } from "convex/values";
import { type Doc } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { authMutation } from "../lib/auth";
import { isOwnedByUser } from "../content/helpers";
import { getAppUser } from "../users/helpers";
import { bioEntryKindValidator } from "./schema";

const MAX_TITLE_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_LINK_LENGTH = 2000;
// Soft-cap. NOT transactional across processes — see NFR-05 in the spec.
// Two separate Convex worker processes can both observe count===49 and both
// commit, yielding 51 entries. This is benign; subsequent creates correctly
// reject. The unit test exercises the in-process sequential path that
// `convex-test` can faithfully simulate.
export const MAX_BIO_ENTRIES_PER_USER = 50;

type BioPatch = Partial<
  Omit<Doc<"bioEntries">, "_id" | "_creationTime" | "userId">
>;

function validateString(value: string, field: string, maxLength: number): void {
  if (value.length > maxLength) {
    throw new Error(
      `${field} exceeds maximum length of ${maxLength} (got ${value.length})`,
    );
  }
}

function validateDateRange(startDate: number, endDate: number | null): void {
  if (endDate !== null && endDate < startDate) {
    throw new Error("endDate must be greater than or equal to startDate");
  }
}

export const create = authMutation({
  args: {
    kind: bioEntryKindValidator,
    title: v.string(),
    startDate: v.number(),
    endDate: v.union(v.number(), v.null()),
    description: v.optional(v.string()),
    link: v.optional(v.string()),
  },
  returns: v.id("bioEntries"),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);

    if (args.title.trim().length === 0) {
      throw new Error("title is required");
    }
    validateString(args.title, "title", MAX_TITLE_LENGTH);
    if (args.description !== undefined) {
      validateString(args.description, "description", MAX_DESCRIPTION_LENGTH);
    }
    if (args.link !== undefined) {
      validateString(args.link, "link", MAX_LINK_LENGTH);
    }
    validateDateRange(args.startDate, args.endDate);

    // Soft-cap. See note above for cross-process race semantics.
    const existingCount = await ctx.db
      .query("bioEntries")
      .withIndex("by_userId", (q) => q.eq("userId", appUser._id))
      .collect();
    if (existingCount.length >= MAX_BIO_ENTRIES_PER_USER) {
      throw new Error(
        `Bio entry limit reached (${MAX_BIO_ENTRIES_PER_USER}). Please remove an existing entry first.`,
      );
    }

    const entryId = await ctx.db.insert("bioEntries", {
      userId: appUser._id,
      kind: args.kind,
      title: args.title,
      startDate: args.startDate,
      endDate: args.endDate,
      description: args.description,
      link: args.link,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.actions.generateEmbedding,
      { sourceTable: "bioEntries" as const, sourceId: entryId },
    );

    return entryId;
  },
});

/**
 * Update args use `v.optional(...)` for partial-patch semantics — omitting a
 * field leaves it unchanged. There is no separate "clear this optional
 * string" affordance: to clear `description` or `link`, the caller submits
 * `""` (empty string). The serializer at `bio/serializeForEmbedding.ts`
 * does `?.trim()` + truthy check, so `description: ""` and
 * `description: undefined` produce identical embedding output, and
 * `articles`/`posts` mutations use the same convention. The Wave 3 form
 * layer is responsible for emitting `""` when the user clears the field.
 */
export const update = authMutation({
  args: {
    id: v.id("bioEntries"),
    kind: v.optional(bioEntryKindValidator),
    title: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.union(v.number(), v.null())),
    description: v.optional(v.string()),
    link: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new Error("Bio entry not found");
    }
    if (!isOwnedByUser(entry, appUser._id)) {
      throw new Error("Not authorized to update this bio entry");
    }

    if (args.title !== undefined) {
      if (args.title.trim().length === 0) {
        throw new Error("title is required");
      }
      validateString(args.title, "title", MAX_TITLE_LENGTH);
    }
    if (args.description !== undefined) {
      validateString(args.description, "description", MAX_DESCRIPTION_LENGTH);
    }
    if (args.link !== undefined) {
      validateString(args.link, "link", MAX_LINK_LENGTH);
    }

    const nextStart = args.startDate ?? entry.startDate;
    const nextEnd =
      args.endDate !== undefined ? args.endDate : entry.endDate;
    validateDateRange(nextStart, nextEnd);

    const patch: BioPatch = {};
    if (args.kind !== undefined) patch.kind = args.kind;
    if (args.title !== undefined) patch.title = args.title;
    if (args.startDate !== undefined) patch.startDate = args.startDate;
    if (args.endDate !== undefined) patch.endDate = args.endDate;
    if (args.description !== undefined) patch.description = args.description;
    if (args.link !== undefined) patch.link = args.link;

    await ctx.db.patch(args.id, patch);

    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.actions.generateEmbedding,
      { sourceTable: "bioEntries" as const, sourceId: args.id },
    );

    return null;
  },
});

export const remove = authMutation({
  args: {
    id: v.id("bioEntries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const appUser = await getAppUser(ctx, ctx.user._id);
    const entry = await ctx.db.get(args.id);
    if (!entry) {
      throw new Error("Bio entry not found");
    }
    if (!isOwnedByUser(entry, appUser._id)) {
      throw new Error("Not authorized to delete this bio entry");
    }

    await ctx.db.delete(args.id);

    await ctx.scheduler.runAfter(
      0,
      internal.embeddings.mutations.deleteBySource,
      { sourceTable: "bioEntries" as const, sourceId: args.id },
    );

    return null;
  },
});
