import { ScrollableArticleList, MOCK_ARTICLES } from "@/features/articles";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <ScrollableArticleList articles={MOCK_ARTICLES} username={username} />;
}
