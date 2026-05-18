"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { showToast } from "@feel-good/ui/components/toast";
import { getContentHref } from "@/features/content";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { getMutationErrorMessage } from "@/lib/get-mutation-error-message";
import { type PostSummary } from "../types";

// Eager (detail-page) mode

export type UseDeletePostEagerArgs = {
  postId: PostSummary["_id"];
  username: string;
};

export type UseDeletePostEagerReturn = {
  dialogOpen: boolean;
  isPending: boolean;
  handleConfirm: () => Promise<void>;
  handleCancel: () => void;
  handleOpenChange: (open: boolean) => void;
};

// Late-bound (list-page) mode

export type UseDeletePostListArgs = {
  postId?: undefined;
  username: string;
};

export type UseDeletePostListReturn = UseDeletePostEagerReturn & {
  requestDelete: (post: PostSummary) => void;
};

// Overloads

export function useDeletePost(
  args: UseDeletePostEagerArgs,
): UseDeletePostEagerReturn;
export function useDeletePost(
  args: UseDeletePostListArgs,
): UseDeletePostListReturn;

// Implementation

export function useDeletePost({
  postId,
  username,
}: UseDeletePostEagerArgs | UseDeletePostListArgs):
  | UseDeletePostEagerReturn
  | UseDeletePostListReturn {
  const router = useRouter();
  const { buildChatAwareHref } = useChatSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const isSubmittingRef = useRef(false);

  // Late-bound target for list mode; null in eager mode.
  const targetPostRef = useRef<PostSummary | null>(null);

  const removeMutation = useMutation(api.posts.mutations.remove);

  // Single optimistic-update block — the sole source of truth for the filter.
  const removePosts = useMemo(
    () =>
      removeMutation.withOptimisticUpdate((store, args) => {
        const current = store.getQuery(api.posts.queries.getByUsername, {
          username,
        });
        if (current == null) return;
        store.setQuery(
          api.posts.queries.getByUsername,
          { username },
          current.filter((post) => !args.ids.includes(post._id)),
        );
      }),
    [removeMutation, username],
  );

  const handleConfirm = useCallback(async () => {
    // Resolve the target id from either the eager prop or the late-bound ref.
    const resolvedId = postId ?? targetPostRef.current?._id;
    if (isSubmittingRef.current || resolvedId == null) return;
    isSubmittingRef.current = true;
    setIsPending(true);

    try {
      if (postId != null) {
        // FG_168: Navigate first so the post-detail unmount happens before
        // Convex invalidates the getById subscription — prevents the
        // blank-flash where PostDetailConnector renders null between mutation
        // resolve and route paint.
        router.replace(buildChatAwareHref(getContentHref(username, "posts")));
      }
      await removePosts({ ids: [resolvedId] });
      showToast({ type: "success", title: "Post deleted" });
      setDialogOpen(false);
      targetPostRef.current = null;
    } catch (err) {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
      // If navigation already fired (detail mode), the error toast surfaces
      // on the posts list page. In list mode, the dialog stays open.
    } finally {
      isSubmittingRef.current = false;
      setIsPending(false);
    }
  }, [postId, removePosts, router, buildChatAwareHref, username]);

  const handleCancel = useCallback(() => {
    if (isSubmittingRef.current) return;
    setDialogOpen(false);
    targetPostRef.current = null;
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open && isSubmittingRef.current) return;
    setDialogOpen(open);
    if (!open) {
      targetPostRef.current = null;
    }
  }, []);

  // List mode only: open dialog for a specific post.
  const requestDelete = useCallback((post: PostSummary) => {
    targetPostRef.current = post;
    setDialogOpen(true);
  }, []);

  const base: UseDeletePostEagerReturn = {
    dialogOpen,
    isPending,
    handleConfirm,
    handleCancel,
    handleOpenChange,
  };

  // Eager mode: do not expose requestDelete.
  if (postId != null) {
    return base;
  }

  // Late-bound mode: expose requestDelete.
  return { ...base, requestDelete };
}
