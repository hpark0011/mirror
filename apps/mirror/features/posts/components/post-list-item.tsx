"use client";

import Image from "next/image";
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
    <article className="border-b border-border-subtle px-4.5 py-10 last:border-b-0">
      <div className="flex flex-col md:flex-row  md:items-start md:justify-between gap-5 md:gap-12 w-full items-center justify-center">
        <div className="mt-0.5 md:max-w-22 w-full max-w-lg">
          <PostMetadata post={post} capitalizeCategory />
        </div>
        <div className="flex flex-col items-center w-full">
          <div className="max-w-lg flex flex-col gap-2 w-full">
            {post.coverImageUrl && (
              <Link href={href} scroll={false} className="block mb-3.5">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-background-subtle [corner-shape:superellipse(1.3)]">
                  <Image
                    src={post.coverImageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 768px) 32rem, 100vw"
                    className="object-cover"
                  />
                </div>
              </Link>
            )}
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
              className="max-w-xl text-[17px] leading-[1.3] font-regular space-y-2 [&_img]:my-3 mt-0 tracking-[-0.04em]"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
