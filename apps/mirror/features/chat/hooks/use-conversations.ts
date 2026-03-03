"use client";

import { useQuery } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";

type UseConversationsOptions = {
  profileOwnerId: Id<"users">;
  enabled?: boolean;
};

export function useConversations({
  profileOwnerId,
  enabled = true,
}: UseConversationsOptions) {
  const conversations = useQuery(
    api.chat.queries.getConversations,
    enabled ? { profileOwnerId } : "skip",
  );

  return {
    conversations: conversations ?? [],
    isLoading: conversations === undefined,
  };
}
