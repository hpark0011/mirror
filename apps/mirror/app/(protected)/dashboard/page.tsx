import { MOCK_PROFILE } from "@/features/profile";
import { DashboardView } from "./_components/dashboard-view";
import { MOCK_ARTICLES } from "@/features/articles";

export default function DashboardPage() {
  return (
    <DashboardView
      profile={MOCK_PROFILE}
      articles={MOCK_ARTICLES}
    />
  );
}
