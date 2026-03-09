import { PostListToolbarConnector, ScrollablePostList } from "@/features/posts";
import { WorkspaceToolbar } from "@/components/workspace-toolbar-slot";

export default function PostsContentPage() {
  return (
    <>
      <WorkspaceToolbar>
        <PostListToolbarConnector />
      </WorkspaceToolbar>
      <ScrollablePostList />
    </>
  );
}
