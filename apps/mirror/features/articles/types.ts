import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { type JSONContent } from "@feel-good/features/editor/types";

export type ArticleSummary = {
  _id: Id<"articles">;
  _creationTime: number;
  userId: Id<"users">;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  coverImageThumbhash: string | null;
  // PLAN_010: optional MP4 cover sibling URLs. Both null when the article
  // has no video cover. Render precedence: video wins when
  // `coverVideoUrl` is non-null, otherwise the image cover (or none).
  coverVideoUrl: string | null;
  coverVideoPosterUrl: string | null;
  createdAt: number;
  publishedAt?: number;
  status: "draft" | "published";
  category: string;
};

export type ArticleWithBody = ArticleSummary & {
  body: JSONContent;
};
