import { memo } from "react";
import Link from "next/link";
import { TableRow, TableCell } from "@feel-good/ui/primitives/table";
import type { Article } from "../lib/mock-articles";
import { formatShortDate } from "../lib/format-date";

type ArticleListItemProps = {
  article: Article;
  username: string;
};

export const ArticleListItem = memo(function ArticleListItem({ article, username }: ArticleListItemProps) {
  const href = `/@${username}/${article.slug}`;

  return (
    <TableRow className="relative border-b-0 group-hover/list:text-muted-foreground hover:text-secondary-foreground hover:bg-transparent min-h-[44px]">
      <TableCell className="font-medium truncate max-w-0 py-0 text-lg">
        <Link href={href} className="after:absolute after:inset-0">
          {article.title}
        </Link>
      </TableCell>
      <TableCell className="hidden md:table-cell py-0 font-medium">{article.category}</TableCell>
      <TableCell className="text-right py-0 font-medium">
        <time dateTime={article.published_at}>
          {formatShortDate(article.published_at)}
        </time>
      </TableCell>
    </TableRow>
  );
});
