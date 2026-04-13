import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { articlesTable } from "./articles/schema";
import { conversationsTable } from "./chat/schema";
import { contentEmbeddingsTable } from "./embeddings/schema";
import { postsTable } from "./posts/schema";
import { usersTable } from "./users/schema";

export default defineSchema({
  users: usersTable,
  articles: articlesTable,
  posts: postsTable,
  conversations: conversationsTable,
  contentEmbeddings: contentEmbeddingsTable,

  // Test-only table: stores OTPs for @mirror.test emails during Playwright auth setup.
  // Only populated when PLAYWRIGHT_TEST_SECRET env var is set.
  testOtpStore: defineTable({
    email: v.string(),
    otp: v.string(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_createdAt", ["createdAt"]),
});
