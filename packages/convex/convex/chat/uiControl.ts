import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { authComponent } from "../auth/client";
import {
  type UiControlAction,
  uiControlActionsValidator,
} from "./uiControlTypes";
export {
  getTestUiControlResponse,
  inferUiControlResponse,
} from "./uiControlInference";

const MAX_ACTIONS_PER_TURN = 3;
const MAX_SEARCH_QUERY_CHARS = 120;
const MAX_CATEGORY_CHARS = 100;

async function getAppUser(ctx: any) {
  const authUser = await authComponent.safeGetAuthUser(ctx);
  if (!authUser) return null;

  return await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", authUser._id))
    .unique();
}

function serializeAction(action: UiControlAction): UiControlAction {
  if (action.type === "setListControls") {
  return {
      ...action,
      searchQuery: action.searchQuery?.trim().slice(0, MAX_SEARCH_QUERY_CHARS),
      categories: action.categories
        ?.map((category) => category.trim().slice(0, MAX_CATEGORY_CHARS))
        .filter(Boolean),
    };
  }

  if (action.type === "navigate") {
    return {
      ...action,
      slug: action.slug?.trim(),
    };
  }

  return action;
}

async function loadVisibleContent(
  ctx: any,
  profileOwnerId: string,
  kind: "posts" | "articles",
  isOwner: boolean,
) {
  const table = kind === "posts" ? "posts" : "articles";
  const rows = await ctx.db
    .query(table)
    .withIndex("by_userId", (q: any) => q.eq("userId", profileOwnerId))
    .collect();

  return (rows as Array<any>).filter((row: any) =>
    isOwner || row.status === "published"
  );
}

async function validateActions(
  ctx: any,
  conversationId: string,
  profileOwnerId: string,
  actions: UiControlAction[],
) {
  if (actions.length === 0) {
    throw new ConvexError({ code: "NO_UI_CONTROL_ACTIONS" as const });
  }
  if (actions.length > MAX_ACTIONS_PER_TURN) {
    throw new ConvexError({ code: "TOO_MANY_UI_CONTROL_ACTIONS" as const });
  }

  const conversation = await ctx.db.get(conversationId);
  if (!conversation || conversation.profileOwnerId !== profileOwnerId) {
    throw new ConvexError({ code: "INVALID_UI_CONTROL_CONVERSATION" as const });
  }

  const isOwner = conversation.viewerId === profileOwnerId;
  const visibleByKind = new Map<"posts" | "articles", any[]>();

  const getVisible = async (kind: "posts" | "articles") => {
    const cached = visibleByKind.get(kind);
    if (cached) return cached;
    const visible = await loadVisibleContent(ctx, profileOwnerId, kind, isOwner);
    visibleByKind.set(kind, visible);
    return visible;
  };

  const validated: UiControlAction[] = [];

  for (const rawAction of actions) {
    const action = serializeAction(rawAction);
    if (action.type === "clearListControls") {
      validated.push(action);
      continue;
    }

    const visible = await getVisible(action.kind);

    if (action.type === "navigate") {
      if (action.slug) {
        const exists = visible.some((row: any) => row.slug === action.slug);
        if (!exists) {
          throw new ConvexError({
            code: "UI_CONTROL_TARGET_NOT_VISIBLE" as const,
            kind: action.kind,
            slug: action.slug,
          });
        }
      }
      validated.push(action);
      continue;
    }

    if (action.categories && action.categories.length > 0) {
      const visibleCategories = new Set(
        visible.map((row: any) => row.category).filter(Boolean),
      );
      const invalid = action.categories.find(
        (category) => !visibleCategories.has(category),
      );
      if (invalid) {
        throw new ConvexError({
          code: "UI_CONTROL_CATEGORY_NOT_VISIBLE" as const,
          kind: action.kind,
          category: invalid,
        });
      }
    }

    validated.push(action);
  }

    return {
    actions: validated,
    viewerId: conversation.viewerId as Id<"users"> | undefined,
  };
}

export const enqueueValidated = internalMutation({
  args: {
    conversationId: v.id("conversations"),
    profileOwnerId: v.id("users"),
    actions: uiControlActionsValidator,
  },
  returns: v.object({
    ok: v.boolean(),
    count: v.number(),
  }),
  handler: async (ctx, args) => {
    const { actions, viewerId } = await validateActions(
      ctx,
      args.conversationId,
      args.profileOwnerId,
      args.actions as UiControlAction[],
    );

    await ctx.db.insert("uiControlActions", {
      conversationId: args.conversationId,
      profileOwnerId: args.profileOwnerId,
      ...(viewerId ? { viewerId } : {}),
      actions,
      status: "pending",
      createdAt: Date.now(),
    });

    return { ok: true, count: actions.length };
  },
});

export const listPending = query({
  args: {
    conversationId: v.id("conversations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("uiControlActions"),
      _creationTime: v.number(),
      conversationId: v.id("conversations"),
      profileOwnerId: v.id("users"),
      viewerId: v.optional(v.id("users")),
      actions: uiControlActionsValidator,
      status: v.union(
        v.literal("pending"),
        v.literal("applied"),
        v.literal("rejected"),
      ),
      createdAt: v.number(),
      appliedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, { conversationId }) => {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation) return [];

    const appUser = await getAppUser(ctx);
    const isOwner = appUser && appUser._id === conversation.profileOwnerId;
    const isViewer = appUser && conversation.viewerId === appUser._id;
    const isAnonymousConversation =
      !appUser && conversation.viewerId === undefined;

    if (!isOwner && !isViewer && !isAnonymousConversation) {
      return [];
    }

    return await ctx.db
      .query("uiControlActions")
      .withIndex("by_conversationId_and_status", (q) =>
        q.eq("conversationId", conversationId).eq("status", "pending"),
      )
      .order("asc")
      .collect();
  },
});

export const markApplied = mutation({
  args: {
    id: v.id("uiControlActions"),
  },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const record = await ctx.db.get(id);
    if (!record) return null;
    if (record.status === "applied") return null;

    const conversation = await ctx.db.get(record.conversationId);
    if (!conversation) return null;

    const appUser = await getAppUser(ctx);
    const isOwner = appUser && appUser._id === conversation.profileOwnerId;
    const isViewer = appUser && conversation.viewerId === appUser._id;
    const isAnonymousConversation =
      !appUser && conversation.viewerId === undefined;

    if (!isOwner && !isViewer && !isAnonymousConversation) {
      throw new ConvexError({ code: "UI_CONTROL_NOT_AUTHORIZED" as const });
    }

    await ctx.db.patch(id, {
      status: "applied",
      appliedAt: Date.now(),
    });

    return null;
  },
});
