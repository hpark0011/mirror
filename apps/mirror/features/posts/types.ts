import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import type { JSONContent } from "@feel-good/features/editor/types";

export type PostSummary = {
  _id: Id<"posts">;
  _creationTime: number;
  userId: Id<"users">;
  slug: string;
  title: string;
  body: JSONContent;
  createdAt: number;
  publishedAt?: number;
  status: "draft" | "published";
  category: string;
};
