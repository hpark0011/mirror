"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useParams, useRouter, useSelectedLayoutSegment } from "next/navigation";
// Note: useSelectedLayoutSegment() without a parallel routes key returns the
// children slot segment. Since @interaction mirrors the same URL structure,
// this correctly detects chat routes. Using the "interaction" key returns
// incorrect segments due to a (slot) prefix in the segment tree.
import type { Id } from "@feel-good/convex/convex/_generated/dataModel";
import { useConversations, type Conversation } from "@/features/chat";
import type { ChatRouteResolution } from "@/features/chat/types";
import { parseConversationId } from "@/features/chat/lib/parse-conversation-id";
import { useProfileRouteData } from "./profile-route-data-context";

type ChatRouteControllerValue = {
  conversations: Conversation[];
  conversationsLoading: boolean;
  routeResolution: ChatRouteResolution;
  handleConversationIdChange: (id: Id<"conversations"> | null) => void;
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
  const [newConversationIntent, setNewConversationIntent] = useState(false);

  const parsed = useMemo(
    () => parseConversationId(params.conversationId),
    [params.conversationId],
  );
  const conversationId = parsed.status === "valid" ? parsed.id : null;
  const conversationInvalid = parsed.status === "invalid";

  const handleConversationIdChange = useCallback(
    (id: Id<"conversations"> | null) => {
      if (!id) {
        newConversationIntentRef.current = true;
        setNewConversationIntent(true);
      }
      // Intent for non-null id is cleared reactively when conversationId updates
      router.replace(
        id ? `/@${profile.username}/chat/${id}` : `/@${profile.username}/chat`,
      );
    },
    [router, profile.username],
  );

  // Clear new-conversation intent once the URL reflects the selected conversation.
  // This avoids a transient state where intent is false but conversationId is
  // still null (the URL hasn't caught up), which could let the auto-select
  // effect redirect to conversations[0].
  useEffect(() => {
    if (conversationId) {
      newConversationIntentRef.current = false;
      setNewConversationIntent(false);
    }
  }, [conversationId]);

  // Auto-select latest conversation when on /chat with no conversationId.
  // Skip when the param is invalid — show "not available" instead.
  useEffect(() => {
    if (!isChatRoute) return;
    if (conversationId) return;
    if (conversationInvalid) return;
    if (conversationsLoading) return;
    if (newConversationIntentRef.current) return;
    if (conversations.length > 0) {
      // Navigate directly instead of through handleConversationIdChange
      // to avoid triggering setState inside the effect.
      router.replace(`/@${profile.username}/chat/${conversations[0]._id}`);
    }
  }, [
    isChatRoute,
    conversationId,
    conversationInvalid,
    conversationsLoading,
    conversations,
    router,
    profile.username,
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
    }),
    [conversations, conversationsLoading, routeResolution, handleConversationIdChange],
  );

  return (
    <ChatRouteControllerContext.Provider value={value}>
      {children}
    </ChatRouteControllerContext.Provider>
  );
}
