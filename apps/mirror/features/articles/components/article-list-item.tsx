import { memo } from "react";
import Link from "next/link";
import { TableCell, TableRow } from "@feel-good/ui/primitives/table";
import { Checkbox } from "@feel-good/ui/primitives/checkbox";
import type { Article } from "../lib/mock-articles";
import { formatShortDate } from "../lib/format-date";

type ArticleListItemProps = {
  article: Article;
  username: string;
  isOwner?: boolean;
  isSelected?: boolean;
  onToggle?: (slug: string) => void;
};

export const ArticleListItem = memo(function ArticleListItem({
  article,
  username,
  isOwner = false,
  isSelected = false,
  onToggle,
}: ArticleListItemProps) {
  const href = `/@${username}/${article.slug}`;

  return (
    <TableRow
      className="relative border-b-0 group-hover/list:text-muted-foreground hover:text-secondary-foreground hover:bg-transparent min-h-[44px]"
      data-state={isSelected ? "selected" : undefined}
    >
      {isOwner && (
        <TableCell className="relative z-10 w-12 py-0 pl-1.5 [&:has([role=checkbox])]:pr-2 rounded-l-md">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggle?.(article.slug)}
            aria-label={`Select ${article.title}`}
          />
        </TableCell>
      )}
      <TableCell className="font-medium truncate max-w-0 py-0 text-lg">
        <Link href={href} className="after:absolute after:inset-0">
          {article.title}
        </Link>
      </TableCell>
      <TableCell className="hidden md:table-cell py-0 font-medium">
        {article.category}
      </TableCell>
      <TableCell className="text-right py-0 font-medium rounded-r-md">
        <time dateTime={article.published_at}>
          {formatShortDate(article.published_at)}
        </time>
      </TableCell>
    </TableRow>
  );
});
