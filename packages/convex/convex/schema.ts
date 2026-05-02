import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { articlesTable } from "./articles/schema";
import { betaAllowlistTable } from "./betaAllowlist/schema";
import { bioEntriesTable } from "./bio/schema";
import { conversationsTable } from "./chat/schema";
import { contentEmbeddingsTable } from "./embeddings/schema";
import { inlineImageOwnershipTable } from "./content/inlineImageOwnershipSchema";
import { postsTable } from "./posts/schema";
import { usersTable } from "./users/schema";
import { waitlistRequestsTable } from "./waitlistRequests/schema";

export default defineSchema({
  users: usersTable,
  articles: articlesTable,
  posts: postsTable,
  bioEntries: bioEntriesTable,
  conversations: conversationsTable,
  contentEmbeddings: contentEmbeddingsTable,
  inlineImageOwnership: inlineImageOwnershipTable,
  betaAllowlist: betaAllowlistTable,
  waitlistRequests: waitlistRequestsTable,

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
