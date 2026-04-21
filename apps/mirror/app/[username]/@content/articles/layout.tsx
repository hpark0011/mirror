import { preloadAuthOptionalQuery } from "@/lib/auth-server";
import { api } from "@feel-good/convex/convex/_generated/api";
import { ArticleWorkspaceProvider } from "@/features/articles";

export default async function ArticlesContentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const preloadedArticles = await preloadAuthOptionalQuery(
    api.articles.queries.getByUsername,
    { username },
  );

  return (
    <ArticleWorkspaceProvider
      preloadedArticles={preloadedArticles}
      username={username}
    >
      {children}
    </ArticleWorkspaceProvider>
  );
}
