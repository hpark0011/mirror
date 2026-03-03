"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";

type ChatContextValue = {
  profileOwnerId: Id<"users">;
  profileName: string;
  avatarUrl: string | null;
  conversationId: Id<"conversations"> | null;
  conversationInvalid: boolean;
  setConversationId: (id: Id<"conversations"> | null) => void;
  startNewConversation: () => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

type ChatProviderProps = {
  profileOwnerId: Id<"users">;
  profileName: string;
  avatarUrl: string | null;
  conversationId: Id<"conversations"> | null;
  conversationInvalid: boolean;
  onConversationIdChange: (id: Id<"conversations"> | null) => void;
  children: React.ReactNode;
};

export function ChatProvider({
  profileOwnerId,
  profileName,
  avatarUrl,
  conversationId,
  conversationInvalid,
  onConversationIdChange,
  children,
}: ChatProviderProps) {
  const startNewConversation = useCallback(() => {
    onConversationIdChange(null);
  }, [onConversationIdChange]);

  const value = useMemo(
    () => ({
      profileOwnerId,
      profileName,
      avatarUrl,
      conversationId,
      conversationInvalid,
      setConversationId: onConversationIdChange,
      startNewConversation,
    }),
    [profileOwnerId, profileName, avatarUrl, conversationId, conversationInvalid, onConversationIdChange, startNewConversation],
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
