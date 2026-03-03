"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@feel-good/ui/primitives/table";
import { Checkbox } from "@feel-good/ui/primitives/checkbox";
import type { Article } from "../types";
import { ArticleListItem } from "../components/article-list-item";
import { ArticleListLoader } from "../components/article-list-loader";
import { cn } from "@feel-good/utils/cn";

type ArticleListProps = {
  articles: Article[];
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
    <section className="w-full mx-auto **:data-[slot=table-container]:overflow-visible">
      <Table>
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="border-b-0 hover:bg-transparent">
            {isOwner && (
              <TableHead className="w-12 h-8 pl-4 [&:has([role=checkbox])]:pr-2">
                <Checkbox
                  checked={isIndeterminate ? "indeterminate" : isAllSelected}
                  onCheckedChange={onToggleAll}
                  aria-label="Select all articles"
                />
              </TableHead>
            )}
            <TableHead
              className={cn(
                "w-4/5 md:w-3/5 text-muted-foreground h-8 pl-4",
                isOwner && "pl-0",
              )}
            >
              Title
            </TableHead>
            <TableHead className="hidden md:table-cell w-1/5 text-muted-foreground h-8">
              Category
            </TableHead>
            <TableHead className="text-right w-1/5 text-muted-foreground h-8 pr-4">
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
