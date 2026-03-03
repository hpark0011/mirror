"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useParams, useRouter, useSelectedLayoutSegment } from "next/navigation";
// Note: useSelectedLayoutSegment() without a parallel routes key returns the
// children slot segment. Since @interaction mirrors the same URL structure,
// this correctly detects chat routes. Using the "interaction" key returns
// incorrect segments due to a (slot) prefix in the segment tree.
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import { useConversations, type Conversation } from "@/features/chat";
import { parseConversationId } from "@/features/chat/lib/parse-conversation-id";
import { useProfileRouteData } from "./profile-route-data-context";

type ChatRouteControllerValue = {
  conversations: Conversation[];
  conversationsLoading: boolean;
  conversationId: Id<"conversations"> | null;
  conversationInvalid: boolean;
  handleConversationIdChange: (id: Id<"conversations"> | null) => void;
  handleBack: () => void;
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
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const params = useParams<{ conversationId?: string }>();

  const isChatRoute = segment === "chat";

  const { conversations, isLoading: conversationsLoading } = useConversations({
    profileOwnerId: profile._id,
    enabled: isChatRoute,
  });

  const newConversationIntentRef = useRef(false);

  const parsed = useMemo(
    () => parseConversationId(params.conversationId),
    [params.conversationId],
  );
  const conversationId = parsed.status === "valid" ? parsed.id : null;
  const conversationInvalid = parsed.status === "invalid";

  const handleBack = useCallback(() => {
    router.push(`/@${profile.username}`);
  }, [router, profile.username]);

  const handleConversationIdChange = useCallback(
    (id: Id<"conversations"> | null) => {
      newConversationIntentRef.current = !id;
      if (id) {
        router.replace(`/@${profile.username}/chat/${id}`);
      } else {
        router.replace(`/@${profile.username}/chat`);
      }
    },
    [router, profile.username],
  );

  // Auto-select latest conversation when on /chat with no conversationId.
  // Skip when the param is invalid — show "not available" instead.
  useEffect(() => {
    if (!isChatRoute) return;
    if (conversationId) return;
    if (conversationInvalid) return;
    if (conversationsLoading) return;
    if (newConversationIntentRef.current) return;
    if (conversations.length > 0) {
      handleConversationIdChange(conversations[0]._id);
    }
  }, [
    isChatRoute,
    conversationId,
    conversationInvalid,
    conversationsLoading,
    conversations,
    handleConversationIdChange,
  ]);

  const value = useMemo(
    () => ({
      conversations,
      conversationsLoading,
      conversationId,
      conversationInvalid,
      handleConversationIdChange,
      handleBack,
    }),
    [
      conversations,
      conversationsLoading,
      conversationId,
      conversationInvalid,
      handleConversationIdChange,
      handleBack,
    ],
  );

  return (
    <ChatRouteControllerContext.Provider value={value}>
      {children}
    </ChatRouteControllerContext.Provider>
  );
}
