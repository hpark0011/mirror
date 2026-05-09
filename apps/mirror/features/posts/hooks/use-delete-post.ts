"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { showToast } from "@feel-good/ui/components/toast";
import { getContentHref } from "@/features/content";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { getMutationErrorMessage } from "../../bio/utils/mutation-helpers";
import { type PostSummary } from "../types";

export type UseDeletePostArgs = {
  postId: PostSummary["_id"];
  username: string;
};

export type UseDeletePostReturn = {
  dialogOpen: boolean;
  isPending: boolean;
  handleConfirm: () => Promise<void>;
  handleCancel: () => void;
  handleOpenChange: (open: boolean) => void;
};

export function useDeletePost({
  postId,
  username,
}: UseDeletePostArgs): UseDeletePostReturn {
  const router = useRouter();
  const { buildChatAwareHref } = useChatSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const isSubmittingRef = useRef(false);

  const removeMutation = useMutation(api.posts.mutations.remove);

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
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsPending(true);

    try {
      // FG_168: Navigate first so the post-detail unmount happens before Convex
      // invalidates the getById subscription — prevents the blank-flash where
      // PostDetailConnector renders null between mutation resolve and route paint.
      router.replace(buildChatAwareHref(getContentHref(username, "posts")));
      await removePosts({ ids: [postId] });
      showToast({ type: "success", title: "Post deleted" });
      setDialogOpen(false);
    } catch (err) {
      showToast({ type: "error", title: getMutationErrorMessage(err) });
      // Navigation already fired; error toast surfaces on the posts list page.
    } finally {
      isSubmittingRef.current = false;
      setIsPending(false);
    }
  }, [postId, removePosts, router, buildChatAwareHref, username]);

  const handleCancel = useCallback(() => {
    if (isSubmittingRef.current) return;
    setDialogOpen(false);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open && isSubmittingRef.current) return;
    setDialogOpen(open);
  }, []);

  return {
    dialogOpen,
    isPending,
    handleConfirm,
    handleCancel,
    handleOpenChange,
  };
}
