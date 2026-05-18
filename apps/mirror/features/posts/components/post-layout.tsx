import { type ReactNode } from "react";
import { cn } from "@feel-good/utils/cn";
import { PostMetadata } from "./detail/post-metadata";
import { PostBody } from "./post-body";
import { type PostSummary } from "../types";

type PostLayoutProps = {
  post: PostSummary;
  /**
   * Surface-specific cover block, or `null` when the post has no cover.
   * List rows wrap it in a `<Link>` with visibility-gated video; the detail
   * page uses a plain `<div>` with an autoplaying video. Whether a cover
   * exists for the gap matrix is derived from `post`, not this slot.
   */
  cover: ReactNode;
  /**
   * Surface-specific heading: `<h2><Link>…</Link></h2>` for list rows,
   * `<h1>…</h1>` for the detail page. Rendered even when the post is
   * titleless (empty heading) so spacing is identical across surfaces.
   */
  title: ReactNode;
  capitalizeCategory?: boolean;
};

/**
 * The single source of truth for how a post is laid out — metadata column,
 * cover, title, and body in the standard frame, plus the no-title / no-cover
 * gap matrix. `PostListItem` and `PostDetail` both compose this so the two
 * surfaces cannot drift. They previously kept four divergent copies of this
 * markup (gap values, the first-paragraph reset, the outer wrapper, and the
 * body renderer all differed), which is what produced the misaligned body on
 * the detail page.
 *
 * Gap matrix:
 *   no title + no cover  -> gap-0   (body flush, aligns with metadata)
 *   no title + cover     -> gap-1.5
 *   has title            -> gap-2
 */
export function PostLayout({
  post,
  cover,
  title,
  capitalizeCategory,
}: PostLayoutProps) {
  const titleless = post.title.trim() === "";
  const hasCover = Boolean(post.coverVideoUrl || post.coverImageUrl);
  const shouldCollapseGap = titleless && !hasCover;

  return (
    <div className="flex flex-col md:flex-row  md:items-start md:justify-between gap-5 md:gap-12 w-full items-center justify-center">
      <div className="mt-0.5 md:max-w-22 w-full max-w-lg">
        <PostMetadata post={post} capitalizeCategory={capitalizeCategory} />
      </div>
      <div className="flex flex-col items-center w-full">
        <div
          className={cn(
            "max-w-lg flex flex-col w-full",
            shouldCollapseGap ? "gap-0" : titleless ? "gap-1.5" : "gap-2",
          )}
        >
          {cover}
          <div className="flex flex-col gap-3">{title}</div>
          <PostBody content={post.body} titleless={titleless} />
        </div>
      </div>
    </div>
  );
}
