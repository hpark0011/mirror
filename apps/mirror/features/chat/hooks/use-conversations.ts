"use client";

import { useQuery } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";

type UseConversationsOptions = {
  profileOwnerId: Id<"users">;
};

export function useConversations({ profileOwnerId }: UseConversationsOptions) {
  const conversations = useQuery(api.chat.queries.getConversations, {
    profileOwnerId,
  });

  return {
    conversations: conversations ?? [],
    isLoading: conversations === undefined,
  };
}
