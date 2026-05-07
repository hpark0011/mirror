"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { type Id } from "@feel-good/convex/convex/_generated/dataModel";
import { useConversations, type Conversation } from "@/features/chat";
import { type ChatRouteResolution } from "@/features/chat/types";
import { parseConversationId } from "@/features/chat/lib/parse-conversation-id";
import { useChatSearchParams } from "@/hooks/use-chat-search-params";
import { useProfileRouteData } from "./profile-route-data-context";

type ChatRouteControllerValue = {
  conversations: Conversation[];
  conversationsLoading: boolean;
  routeResolution: ChatRouteResolution;
  handleConversationIdChange: (id: Id<"conversations"> | null) => void;
  closeChat: () => void;
};

const ChatRouteControllerContext =
  createContext<ChatRouteControllerValue | null>(null);

export function useChatRouteController() {
  const ctx = useContext(ChatRouteControllerContext);
  if (!ctx) {
    throw new Error(
      "useChatRouteController must be used within ChatRouteController",
    );
  }
  return ctx;
}

type ChatRouteControllerProps = {
  children: ReactNode;
};

export function ChatRouteController({ children }: ChatRouteControllerProps) {
  const { profile } = useProfileRouteData();
  const {
    isChatOpen,
    conversationId: rawConversationId,
    setConversation,
    openChat,
    closeChat,
  } = useChatSearchParams();

  const { conversations, isLoading: conversationsLoading } = useConversations({
    profileOwnerId: profile._id,
    enabled: isChatOpen,
  });

  const [newConversationIntent, setNewConversationIntent] = useState(false);

  const parsed = useMemo(
    () => parseConversationId(rawConversationId),
    [rawConversationId],
  );
  const conversationId = parsed.status === "valid" ? parsed.id : null;
  const conversationInvalid = parsed.status === "invalid";

  const handleConversationIdChange = useCallback(
    (id: Id<"conversations"> | null) => {
      if (!id) {
        setNewConversationIntent(true);
        openChat();
      } else {
        setNewConversationIntent(false);
        setConversation(id);
      }
    },
    [openChat, setConversation],
  );

  // Auto-select latest conversation when chat is open with no conversationId.
  useEffect(() => {
    if (!isChatOpen) return;
    if (conversationId) return;
    if (conversationInvalid) return;
    if (conversationsLoading) return;
    if (newConversationIntent) return;
    if (conversations.length > 0) {
      setConversation(conversations[0]._id);
    }
  }, [
    isChatOpen,
    conversationId,
    conversationInvalid,
    conversationsLoading,
    newConversationIntent,
    conversations,
    setConversation,
  ]);

  const routeResolution = useMemo((): ChatRouteResolution => {
    if (conversationInvalid) return { status: "invalid" };
    if (conversationId) return { status: "ready", conversationId };
    if (newConversationIntent) return { status: "new_conversation" };
    if (conversationsLoading || conversations.length > 0)
      return { status: "resolving" };
    return { status: "empty" };
  }, [
    conversationId,
    conversationInvalid,
    newConversationIntent,
    conversationsLoading,
    conversations.length,
  ]);

  const value = useMemo(
    () => ({
      conversations,
      conversationsLoading,
      routeResolution,
      handleConversationIdChange,
      closeChat,
    }),
    [conversations, conversationsLoading, routeResolution, handleConversationIdChange, closeChat],
  );

  return (
    <ChatRouteControllerContext.Provider value={value}>
      {children}
    </ChatRouteControllerContext.Provider>
  );
}
