"use client";

import Link from "next/link";
import { ContentBody } from "@feel-good/features/editor/components";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { formatLongDate, getContentHref } from "@/features/content";
import type { PostSummary } from "../types";

type PostListItemProps = {
  post: PostSummary;
  username: string;
};

export function PostListItem({ post, username }: PostListItemProps) {
  const { buildChatAwareHref } = useChatSearchParams();
  const href = buildChatAwareHref(getContentHref(username, "posts", post.slug));
  const publishedLabel = post.status === "draft"
    ? "Draft"
    : formatLongDate(post.publishedAt ?? post.createdAt);

  return (
    <article className="border-b border-border-subtle px-4.5 py-8 last:border-b-0">
      <div className="flex items-start justify-between gap-20 w-full">
        <div className="flex flex-col">
          <span className="shrink-0 text-[13px] font-medium w-24 whitespace-nowrap tracking-[-0.06em] leading-1.2 uppercase">
            {publishedLabel}
          </span>
          <span className="text-[14px] font-medium leading-[1.2]">
            {post.category}
          </span>
        </div>
        <div className="min-w-0 space-y-3 w-lg">
          <div className="flex flex-col gap-3">
            <h2 className="text-xl leading-tight underline decoration-transparent transition-colors hover:text-blue-11">
              <Link href={href} scroll={false}>
                <span className="underline">{post.title}</span>
              </Link>
            </h2>
          </div>

          <ContentBody
            content={post.body}
            className="max-w-xl text-[17px] leading-[1.3] font-regular space-y-2 [&_img]:my-3 mt-4"
          />
        </div>
      </div>
    </article>
  );
}
