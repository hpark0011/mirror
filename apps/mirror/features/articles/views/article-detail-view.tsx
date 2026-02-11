import { formatLongDate } from "../lib/format-date";
import type { Article } from "../lib/mock-articles";

type ArticleDetailViewProps = {
  article: Article;
};

export function ArticleDetailView({ article }: ArticleDetailViewProps) {
  const paragraphs = article.body.split("\n\n");

  return (
    <div className="py-22 px-4 bg-background min-h-[calc(100vh-40px)]">
      <article className="max-w-xl mx-auto">
        <div className="mb-[56px]">
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[15px] text-muted-foreground leading-[1.2]">
              {formatLongDate(article.published_at)}
            </span>

            <span className="text-[15px] font-medium text-muted-foreground leading-[1.2]">
              {article.category}
            </span>
          </div>
          <h1 className="text-3xl font-medium mt-[48px] leading-tight tracking-[-0.02em] text-center">
            {article.title}
          </h1>
        </div>

        <div className="space-y-5 text-[19px] leading-[1.4] font-[480] text-secondary-foreground [&>p:not(:first-child)]:indent-14">
          {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </article>
    </div>
  );
}
