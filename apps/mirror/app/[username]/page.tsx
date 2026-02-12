import { ScrollableArticleList, MOCK_ARTICLES } from "@/features/articles";
import { isAuthenticated } from "@/lib/auth-server";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const isOwner = await isAuthenticated();
  const articles = isOwner
    ? MOCK_ARTICLES
    : MOCK_ARTICLES.filter((a) => a.status === "published");
  return <ScrollableArticleList articles={articles} username={username} />;
}
