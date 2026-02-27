import { defineSchema } from "convex/server";
import { usersTable } from "./users/schema";
import { articlesTable } from "./articles/schema";

export default defineSchema({
  users: usersTable,
  articles: articlesTable,
});
