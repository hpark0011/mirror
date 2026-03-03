import { memo } from "react";
import Link from "next/link";
import { TableCell } from "@feel-good/ui/primitives/table";
import { Checkbox } from "@feel-good/ui/primitives/checkbox";
import type { Article } from "../types";
import { formatShortDate } from "../utils/format-date";
import { AnimatedArticleRow } from "./animated-article-row";
import { cn } from "@feel-good/utils/cn";

type ArticleListItemProps = {
  article: Article;
  username: string;
  isOwner?: boolean;
  isSelected?: boolean;
  onToggle?: (slug: string) => void;
  shouldAnimate?: boolean;
  index?: number;
};

export const ArticleListItem = memo(function ArticleListItem({
  article,
  username,
  isOwner = false,
  isSelected = false,
  onToggle,
  shouldAnimate = false,
  index = 0,
}: ArticleListItemProps) {
  const href = `/@${username}/${article.slug}`;

  return (
    <AnimatedArticleRow
      shouldAnimate={shouldAnimate}
      index={index}
      className="relative border-b-0 group-hover/list:text-muted-foreground hover:text-secondary-foreground min-h-[44px] hover:bg-muted"
      data-state={isSelected ? "selected" : undefined}
    >
      {isOwner && (
        <TableCell className="relative z-10 w-12 py-0 [&:has([role=checkbox])]:pr-2 pl-4">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggle?.(article.slug)}
            aria-label={`Select ${article.title}`}
          />
        </TableCell>
      )}
      <TableCell
        className={cn(
          "font-medium truncate max-w-0 py-0 text-lg pl-4",
          isOwner && "pl-0",
        )}
      >
        <Link href={href} className="after:absolute after:inset-0">
          {article.title}
        </Link>
      </TableCell>
      <TableCell className="hidden md:table-cell py-0 font-medium">
        {article.category}
      </TableCell>
      <TableCell className="text-right py-0 font-medium pr-4">
        {article.status === "draft"
          ? <span className="text-muted-foreground">Draft</span>
          : article.publishedAt
          ? (
            <time dateTime={new Date(article.publishedAt).toISOString()}>
              {formatShortDate(article.publishedAt)}
            </time>
          )
          : null}
      </TableCell>
    </AnimatedArticleRow>
  );
});
