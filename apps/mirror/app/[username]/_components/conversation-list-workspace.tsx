"use client";

import { ConversationList } from "@/features/chat";
import { WorkspaceNavbar } from "@/components/workspace-navbar";
import { ToolbarSlotProvider } from "@/components/workspace-toolbar-slot";
import { useChatRouteController } from "../_providers/chat-route-controller";

export function ConversationListWorkspace() {
  const { conversations, routeResolution, handleConversationIdChange } =
    useChatRouteController();

  const activeConversationId =
    routeResolution.status === "ready" ? routeResolution.conversationId : null;

  return (
    <ToolbarSlotProvider>
      <div className="relative h-full min-w-0 flex flex-col">
        <WorkspaceNavbar />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelect={handleConversationIdChange}
          />
        </div>
      </div>
    </ToolbarSlotProvider>
  );
}
