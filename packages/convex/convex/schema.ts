import { defineSchema } from "convex/server";
import { articlesTable } from "./articles/schema";
import { conversationsTable } from "./chat/schema";
import { postsTable } from "./posts/schema";
import { usersTable } from "./users/schema";

export default defineSchema({
  users: usersTable,
  articles: articlesTable,
  posts: postsTable,
  conversations: conversationsTable,
});
