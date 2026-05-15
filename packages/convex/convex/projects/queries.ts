import { v } from "convex/values";
import { type Doc, type Id } from "../_generated/dataModel";
import { internalQuery, query, type QueryCtx } from "../_generated/server";
import { resolveStorageUrl } from "../content/helpers";

const MAX_PUBLIC_PROJECTS = 50;

const projectReturnValidator = v.object({
  _id: v.id("projects"),
  _creationTime: v.number(),
  userId: v.id("users"),
  title: v.string(),
  startDate: v.number(),
  endDate: v.union(v.number(), v.null()),
  description: v.optional(v.string()),
  link: v.optional(v.string()),
  coverImageUrl: v.union(v.string(), v.null()),
  coverImageThumbhash: v.union(v.string(), v.null()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const getByUsername = query({
  args: { username: v.string() },
  returns: v.union(v.array(projectReturnValidator), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    if (!user) {
      return null;
    }

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    projects.sort((a, b) => {
      if (a.startDate !== b.startDate) return b.startDate - a.startDate;
      return b._creationTime - a._creationTime;
    });

    const visible = projects.slice(0, MAX_PUBLIC_PROJECTS);
    return await Promise.all(visible.map((project) => toReturn(ctx, project)));
  },
});

export const getById = internalQuery({
  args: { id: v.id("projects") },
  returns: v.union(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      userId: v.id("users"),
      title: v.string(),
      startDate: v.number(),
      endDate: v.union(v.number(), v.null()),
      description: v.optional(v.string()),
      link: v.optional(v.string()),
      coverImageStorageId: v.optional(v.id("_storage")),
      coverImageThumbhash: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

async function toReturn(ctx: QueryCtx, project: Doc<"projects">) {
  return {
    _id: project._id,
    _creationTime: project._creationTime,
    userId: project.userId,
    title: project.title,
    startDate: project.startDate,
    endDate: project.endDate,
    description: project.description,
    link: project.link,
    coverImageUrl: await resolveStorageUrl(
      ctx,
      project.coverImageStorageId as Id<"_storage"> | undefined,
    ),
    coverImageThumbhash: project.coverImageThumbhash ?? null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}
