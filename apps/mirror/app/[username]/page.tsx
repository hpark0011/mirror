import {
  ArticleToolbarView,
  ScrollableArticleList,
} from "@/features/articles";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";

export default function ProfilePage() {
  return (
    <>
      <WorkspaceToolbar>
        <ArticleToolbarView />
      </WorkspaceToolbar>
      <ScrollableArticleList />
    </>
  );
}
