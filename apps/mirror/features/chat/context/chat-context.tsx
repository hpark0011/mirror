"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import type { ChatRouteResolution, Conversation } from "../types";

type ChatContextValue = {
  profileOwnerId: Id<"users">;
  profileName: string;
  username: string;
  avatarUrl: string | null;
  conversationId: Id<"conversations"> | null;
  conversations: Conversation[];
  routeResolution: ChatRouteResolution;
  setConversationId: (id: Id<"conversations"> | null) => void;
  startNewConversation: () => void;
  closeChat: () => void;
  headerAddon: React.ReactNode;
};

const ChatContext = createContext<ChatContextValue | null>(null);

type ChatProviderProps = {
  profileOwnerId: Id<"users">;
  profileName: string;
  username: string;
  avatarUrl: string | null;
  conversationId: Id<"conversations"> | null;
  conversations: Conversation[];
  routeResolution: ChatRouteResolution;
  onConversationIdChange: (id: Id<"conversations"> | null) => void;
  onCloseChat: () => void;
  headerAddon?: React.ReactNode;
  children: React.ReactNode;
};

export function ChatProvider({
  profileOwnerId,
  profileName,
  username,
  avatarUrl,
  conversationId,
  conversations,
  routeResolution,
  onConversationIdChange,
  onCloseChat,
  headerAddon,
  children,
}: ChatProviderProps) {
  const startNewConversation = useCallback(() => {
    onConversationIdChange(null);
  }, [onConversationIdChange]);

  const value = useMemo(
    () => ({
      profileOwnerId,
      profileName,
      username,
      avatarUrl,
      conversationId,
      conversations,
      routeResolution,
      setConversationId: onConversationIdChange,
      startNewConversation,
      closeChat: onCloseChat,
      headerAddon,
    }),
    [profileOwnerId, profileName, username, avatarUrl, conversationId, conversations, routeResolution, onConversationIdChange, startNewConversation, onCloseChat, headerAddon],
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
