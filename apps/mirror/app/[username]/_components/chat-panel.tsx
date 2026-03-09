"use client";

import { ChatProvider, ChatThread } from "@/features/chat";
import { useProfileRouteData } from "../_providers/profile-route-data-context";
import { useChatRouteController } from "../_providers/chat-route-controller";
import { useOptionalWorkspaceChrome } from "../_providers/workspace-chrome-context";
import { DesktopContentPanelToggle } from "./desktop-content-panel-toggle";

export function ChatPanel() {
  const { profile } = useProfileRouteData();
  const { conversations, routeResolution, handleConversationIdChange, closeChat } =
    useChatRouteController();
  const workspaceChrome = useOptionalWorkspaceChrome();

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
      headerAddon={
        workspaceChrome && (
          <DesktopContentPanelToggle
            contentPanelId={workspaceChrome.contentPanelId}
            isContentPanelCollapsed={workspaceChrome.isContentPanelCollapsed}
            toggleContentPanel={workspaceChrome.toggleContentPanel}
          />
        )
      }
    >
      <ChatThread />
    </ChatProvider>
  );
}
