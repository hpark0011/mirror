import { v } from "convex/values";

const contentKindValidator = v.union(v.literal("posts"), v.literal("articles"));
const sortOrderValidator = v.union(v.literal("newest"), v.literal("oldest"));
const datePresetValidator = v.union(
  v.literal("today"),
  v.literal("this_week"),
  v.literal("this_month"),
  v.literal("this_year"),
);

export const uiControlActionValidator = v.union(
  v.object({
    type: v.literal("navigate"),
    kind: contentKindValidator,
    slug: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("setListControls"),
    kind: contentKindValidator,
    searchQuery: v.optional(v.string()),
    sortOrder: v.optional(sortOrderValidator),
    categories: v.optional(v.array(v.string())),
    publishedDatePreset: v.optional(datePresetValidator),
  }),
  v.object({
    type: v.literal("clearListControls"),
    kind: contentKindValidator,
  }),
);

export const uiControlActionsValidator = v.array(uiControlActionValidator);

export type UiControlAction =
  | {
    type: "navigate";
    kind: "posts" | "articles";
    slug?: string;
  }
  | {
    type: "setListControls";
    kind: "posts" | "articles";
    searchQuery?: string;
    sortOrder?: "newest" | "oldest";
    categories?: string[];
    publishedDatePreset?: "today" | "this_week" | "this_month" | "this_year";
  }
  | {
    type: "clearListControls";
    kind: "posts" | "articles";
  };
