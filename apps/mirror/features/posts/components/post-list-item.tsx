"use client";

import Link from "next/link";
import { ContentBody } from "@feel-good/features/editor/components";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { getContentHref } from "@/features/content";
import { PostMetadata } from "./post-metadata";
import type { PostSummary } from "../types";

type PostListItemProps = {
  post: PostSummary;
  username: string;
};

export function PostListItem({ post, username }: PostListItemProps) {
  const { buildChatAwareHref } = useChatSearchParams();
  const href = buildChatAwareHref(getContentHref(username, "posts", post.slug));

  return (
    <article className="border-b border-border-subtle px-4.5 py-10 pb-10 last:border-b-0">
      <div className="flex items-start justify-between gap-12 w-full">
        <div className="mt-0.5">
          <PostMetadata post={post} capitalizeCategory />
        </div>
        <div className="flex flex-col items-center w-full">
          <div className="max-w-lg flex flex-col gap-2">
            <div className="flex flex-col gap-3">
              <h2 className="text-xl leading-tight underline decoration-transparent transition-colors hover:text-blue-11">
                <Link href={href} scroll={false}>
                  <span className="underline capitalize">
                    {post.title}
                  </span>
                </Link>
              </h2>
            </div>

            <ContentBody
              content={post.body}
              className="max-w-xl text-[17px] leading-[1.3] font-regular space-y-2 [&_img]:my-3 mt-4"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
