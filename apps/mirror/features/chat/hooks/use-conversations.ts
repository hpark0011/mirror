"use client";

import { useQuery } from "convex/react";
import { api } from "@feel-good/convex/convex/_generated/api";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { type ChatMode } from "../types";

type UseConversationsOptions = {
  profileOwnerId: Id<"users">;
  mode?: ChatMode;
  enabled?: boolean;
};

export function useConversations({
  profileOwnerId,
  mode = "clone",
  enabled = true,
}: UseConversationsOptions) {
  const conversations = useQuery(
    api.chat.queries.getConversations,
    enabled ? { profileOwnerId, mode } : "skip",
  );

  return {
    conversations: conversations ?? [],
    isLoading: conversations === undefined,
  };
}
