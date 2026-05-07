import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  ensureRickRubinUser,
  ensureRickRubinArticles,
  ensureRickRubinPosts,
  ensureRickRubinConversations,
} from "./seed/helpers";

export const seedRickRubin = internalMutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    return await ensureRickRubinUser(ctx);
  },
});

export const seedRickRubinArticles = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinArticles(ctx, userId);
    return null;
  },
});

export const seedRickRubinPosts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinPosts(ctx, userId);
    return null;
  },
});

export const seedRickRubinConversations = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinConversations(ctx, userId);
    return null;
  },
});

export const seedRickRubinDemo = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const userId = await ensureRickRubinUser(ctx);
    await ensureRickRubinArticles(ctx, userId);
    await ensureRickRubinPosts(ctx, userId);
    await ensureRickRubinConversations(ctx, userId);
    return null;
  },
});
