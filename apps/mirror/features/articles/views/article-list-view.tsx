"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@feel-good/ui/primitives/table";
import type { Article } from "../lib/mock-articles";
import { ArticleListItem } from "../components/article-list-item";
import { ArticleListLoader } from "../components/article-list-loader";

type ArticleListViewProps = {
  articles: Article[];
  hasMore: boolean;
  onLoadMore: () => void;
  scrollRoot?: HTMLElement | null;
};

export function ArticleListView({
  articles,
  hasMore,
  onLoadMore,
  scrollRoot,
}: ArticleListViewProps) {
  return (
    <section className="w-full mx-auto **:data-[slot=table-container]:overflow-visible">
      <Table>
        <TableHeader className="[&_tr]:border-b-0">
          <TableRow className="border-b-0 hover:bg-transparent">
            <TableHead className="w-3/5 text-muted-foreground h-8">
              Title
            </TableHead>
            <TableHead className="hidden md:table-cell w-1/5 text-muted-foreground h-8">
              Category
            </TableHead>
            <TableHead className="text-right w-1/5 text-muted-foreground h-8">
              Published
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="group/list">
          {articles.map((article) => (
            <ArticleListItem key={article.slug} article={article} />
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
