import { notFound } from "next/navigation";
import { ArticleDetailView, findArticleBySlug } from "@/features/articles";
import { isAuthenticated } from "@/lib/auth-server";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { slug } = await params;
  const article = findArticleBySlug(slug);
  if (!article) notFound();
  if (article.status === "draft" && !(await isAuthenticated())) notFound();
  return <ArticleDetailView article={article} />;
}
