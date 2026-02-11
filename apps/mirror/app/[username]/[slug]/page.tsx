import { notFound } from "next/navigation";
import { ArticleDetailView, findArticleBySlug } from "@/features/articles";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { slug } = await params;
  const article = findArticleBySlug(slug);
  if (!article) notFound();
  return <ArticleDetailView article={article} />;
}
