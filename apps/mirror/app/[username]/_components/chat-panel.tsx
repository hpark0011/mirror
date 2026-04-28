"use client";

import { ChatProvider, ChatThread } from "@/features/chat";
import { useProfileRouteData } from "../_providers/profile-route-data-context";
import { useChatRouteController } from "../_providers/chat-route-controller";

export function ChatPanel() {
  const { profile } = useProfileRouteData();
  const { conversations, routeResolution, handleConversationIdChange, closeChat } =
    useChatRouteController();

  const conversationId =
    routeResolution.status === "ready" ? routeResolution.conversationId : null;

  return (
    <ChatProvider
      profileOwnerId={profile._id}
      profileName={profile.name}
      username={profile.username}
      avatarUrl={profile.avatarUrl ?? null}
      conversationId={conversationId}
      conversations={conversations}
      routeResolution={routeResolution}
      onConversationIdChange={handleConversationIdChange}
      onCloseChat={closeChat}
    >
      <ChatThread />
    </ChatProvider>
  );
}
