/**
 * Projects table — public project history per profile owner.
 *
 * Dates use the same month-granularity storage convention as bio entries:
 * epoch ms anchored to the first day of the month UTC. `endDate: null`
 * means the project is ongoing.
 */
import { defineTable } from "convex/server";
import { v } from "convex/values";

export const projectFields = {
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
};

export const projectsTable = defineTable(projectFields).index("by_userId", [
  "userId",
]);
