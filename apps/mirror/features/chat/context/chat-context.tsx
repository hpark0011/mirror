"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";

type ChatContextValue = {
  profileOwnerId: Id<"users">;
  profileName: string;
  avatarUrl: string | null;
  conversationId: Id<"conversations"> | null;
  setConversationId: (id: Id<"conversations"> | null) => void;
  startNewConversation: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

type ChatProviderProps = {
  profileOwnerId: Id<"users">;
  profileName: string;
  avatarUrl: string | null;
  children: React.ReactNode;
};

export function ChatProvider({
  profileOwnerId,
  profileName,
  avatarUrl,
  children,
}: ChatProviderProps) {
  const [conversationId, setConversationId] = useState<
    Id<"conversations"> | null
  >(null);

  const startNewConversation = useCallback(() => {
    setConversationId(null);
  }, []);

  const value = useMemo(
    () => ({
      profileOwnerId,
      profileName,
      avatarUrl,
      conversationId,
      setConversationId,
      startNewConversation,
    }),
    [profileOwnerId, profileName, avatarUrl, conversationId, startNewConversation],
  );

  return <ChatContext value={value}>{children}</ChatContext>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within ChatProvider");
  }
  return context;
}
