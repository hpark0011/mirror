import { v } from "convex/values";
import { authMutation } from "../lib/auth";
import { getAppUser } from "../users/helpers";
import { bioEntryKindValidator } from "./schema";
import {
  createBioEntryForUser,
  removeBioEntryForUser,
  updateBioEntryForUser,
} from "./writeHelpers";

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
    return await createBioEntryForUser(ctx, appUser._id, args);
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
    await updateBioEntryForUser(ctx, appUser._id, args);
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
    await removeBioEntryForUser(ctx, appUser._id, args.id);
    return null;
  },
});
