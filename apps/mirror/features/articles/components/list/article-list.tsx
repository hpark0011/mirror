"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@feel-good/ui/primitives/table";
import { Checkbox } from "@feel-good/ui/primitives/checkbox";
import { type ArticleSummary } from "../../types";
import { ArticleListItem } from "./article-list-item";
import { ArticleListLoader } from "./article-list-loader";
import { cn } from "@feel-good/utils/cn";

type ArticleListProps = {
  articles: ArticleSummary[];
  hasMore: boolean;
  onLoadMore: () => void;
  scrollRoot?: HTMLElement | null;
  username: string;
  isOwner?: boolean;
  isAllSelected?: boolean;
  isIndeterminate?: boolean;
  onToggleAll?: () => void;
  isSelected?: (slug: string) => boolean;
  onToggle?: (slug: string) => void;
  shouldAnimate?: boolean;
};

export function ArticleList({
  articles,
  hasMore,
  onLoadMore,
  scrollRoot,
  username,
  isOwner = false,
  isAllSelected = false,
  isIndeterminate = false,
  onToggleAll,
  isSelected,
  onToggle,
  shouldAnimate = false,
}: ArticleListProps) {
  return (
    <section className="@container w-full mx-auto **:data-[slot=table-container]:overflow-visible pt-8 pb-20 max-w-4xl flex flex-col cursor-pointer">
      <div className="flex flex-col gap-4 mb-4">
        <div className="p-4.5 hover:underline">
          <div className="flex flex-row @max-[480px]:flex-col @max-[480px]:gap-0 gap-10 items-start justify-between">
            {/* Title */}
            <div className="flex flex-col justify-between @max-[480px]:mb-4">
              <div className="md:text-3xl @max-[880px]:text-2xl @max-[480px]:text-2xl text-2xl leading-[1.05]">
                Nature and the Creative Process of People
              </div>
              <div className="mt-4 @max-[480px]:mt-2 @max-[480px]:leading-[1.3] leading-[1.4] text-sm">
                <div>Creativity</div>
                <div>Apr 30, 2026</div>
              </div>
            </div>
            {/* Image */}
            <div className="w-full aspect-video h-full bg-gray-5 max-w-[560px]" />
          </div>
        </div>

        <div className="p-4.5 hover:underline cursor-pointer">
          <div className="flex flex-row @max-[480px]:flex-col @max-[480px]:gap-0 gap-10 items-start justify-between">
            {/* Image */}
            <div className="w-full aspect-video h-full bg-gray-5 max-w-[560px] @max-[480px]:order-2" />
            {/* Title */}
            <div className="flex flex-col justify-between @max-[480px]:mb-4 @max-[480px]:order-1">
              <div className="md:text-3xl @max-[880px]:text-2xl @max-[480px]:text-2xl text-2xl leading-[1.05]">
                Nature and the Creative Process of People
              </div>
              <div className="mt-4 @max-[480px]:mt-2 @max-[480px]:leading-[1.3] leading-[1.4] text-sm">
                <div>Creativity</div>
                <div>Apr 30, 2026</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Table>
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="border-b-0 hover:bg-transparent">
            {isOwner && (
              <TableHead className="w-12 h-8 pl-4.5 [&:has([role=checkbox])]:pr-2">
                <div>
                  <Checkbox
                    checked={isIndeterminate ? "indeterminate" : isAllSelected}
                    onCheckedChange={onToggleAll}
                    aria-label="Select all articles"
                  />
                </div>
              </TableHead>
            )}
            <TableHead
              className={cn(
                "w-4/5 md:w-3/5 text-muted-foreground h-8 pl-6",
                isOwner && "pl-0",
              )}
            >
              Title
            </TableHead>
            <TableHead className="hidden md:table-cell w-1/5 text-muted-foreground h-8">
              Category
            </TableHead>
            <TableHead className="text-right w-1/5 text-muted-foreground h-8 pr-6">
              Published
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="group/list">
          {articles.map((article, index) => (
            <ArticleListItem
              key={article.slug}
              article={article}
              username={username}
              isOwner={isOwner}
              isSelected={isSelected?.(article.slug) ?? false}
              onToggle={onToggle}
              shouldAnimate={shouldAnimate}
              index={index}
            />
          ))}
        </TableBody>
      </Table>
      <ArticleListLoader
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        scrollRoot={scrollRoot}
      />
    </section>
  );
}
