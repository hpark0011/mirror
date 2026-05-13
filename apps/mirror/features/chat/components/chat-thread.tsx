"use client";

import { useCallback, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { ArcSphere } from "../../../components/animated-geometries/arc-sphere";
import { useChatContext } from "../context/chat-context";
import { useAgentIntentWatcher } from "../hooks/use-agent-intent-watcher";
import { useChat } from "../hooks/use-chat";
import { ChatConversationListSheet } from "./chat-conversation-list-sheet";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ChatMessageList } from "./chat-message-list";

export function ChatThread() {
  const {
    routeResolution,
    profileName,
    avatarUrl,
    mode,
    closeChat,
    headerAddon,
  } = useChatContext();
  const headerName = mode === "configuration" ? "Profile helper" : profileName;

  if (routeResolution.status === "resolving") {
    return (
      <div className="flex flex-col h-full relative">
        {headerAddon}
        <div className="absolute top-0 left-0 right-0 z-10 bg-linear-to-b from-transparent to-transparent h-12">
          <ChatHeader
            profileName={headerName}
            avatarUrl={avatarUrl}
            onProfileClick={closeChat}
          />
        </div>
        <div
          data-slot="chat-thread-resolving"
          className="flex-1 flex items-center justify-center pb-20"
        >
          <ArcSphere />
        </div>
      </div>
    );
  }

  if (routeResolution.status === "invalid") {
    return (
      <div className="flex flex-col h-full relative">
        {headerAddon}
        <ChatHeader
          profileName={headerName}
          avatarUrl={avatarUrl}
          onProfileClick={closeChat}
        />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">
            This conversation is not available.
          </p>
        </div>
      </div>
    );
  }

  // ready | new_conversation | empty — mount useChat
  return <ChatActiveThread />;
}

// ─── Active chat thread ──────────────────────────────────────────────────────

function ChatActiveThread() {
  const {
    profileOwnerId,
    profileName,
    avatarUrl,
    mode,
    conversationId,
    conversations,
    routeResolution,
    setConversationId,
    startNewConversation,
    closeChat,
    headerAddon,
  } = useChatContext();

  const { isAuthenticated } = useSession();

  const [conversationListOpen, setConversationListOpen] = useState(false);
  const openConversationList = useCallback(
    () => setConversationListOpen(true),
    [],
  );
  const activeConversationId =
    routeResolution.status === "ready" ? routeResolution.conversationId : null;

  const {
    messages,
    sendMessage,
    retryMessage,
    isResponding,
    conversationNotFound,
    status,
    loadMore,
    sendError,
    clearSendError,
    sendAnimationKey,
  } = useChat({
    profileOwnerId,
    mode,
    conversationId,
    onConversationCreated: setConversationId,
  });

  const isConfigurationMode = mode === "configuration";
  const chatDisplayName = isConfigurationMode ? "Profile helper" : profileName;

  // Watch for agent tool-results that drive UI navigation (the agent half
  // of the "two routes, one dispatcher" pattern — see
  // `app/[username]/_providers/clone-actions-context.tsx`).
  // `conversationId` keys the module-level idempotency Map, so the
  // handled-toolCallId set survives chat-panel close/reopen and
  // conversation switches.
  useAgentIntentWatcher(messages, conversationId);

  // Conversation deleted after route resolved — show error state
  if (conversationNotFound) {
    return (
      <div className="flex flex-col h-full relative">
        {headerAddon}
        <ChatConversationListSheet
          open={conversationListOpen}
          onOpenChange={setConversationListOpen}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={setConversationId}
          isAuthenticated={isAuthenticated}
          title={isConfigurationMode ? "Profile helper chats" : "Conversations"}
        />
        <ChatHeader
          profileName={chatDisplayName}
          avatarUrl={avatarUrl}
          onProfileClick={closeChat}
          onNewConversation={startNewConversation}
          onOpenConversationList={openConversationList}
        />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">
            This conversation is not available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      {headerAddon}
      <ChatConversationListSheet
        open={conversationListOpen}
        onOpenChange={setConversationListOpen}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelect={setConversationId}
        isAuthenticated={isAuthenticated}
        title={isConfigurationMode ? "Profile helper chats" : "Conversations"}
      />
      <div className="absolute top-0 left-0 right-0 z-10 bg-linear-to-b from-transparent to-transparent h-12">
        <ChatHeader
          profileName={chatDisplayName}
          avatarUrl={avatarUrl}
          onProfileClick={closeChat}
          onNewConversation={startNewConversation}
          onOpenConversationList={openConversationList}
        />
      </div>

      <ChatMessageList
        messages={messages}
        avatarUrl={avatarUrl}
        profileName={profileName}
        mode={mode}
        status={status}
        loadMore={loadMore}
        onRetry={retryMessage}
        sendAnimationKey={sendAnimationKey}
      />

      <div className="absolute bottom-0 w-full mx-auto bg-linear-to-t from-background via-30% via-background to-transparent">
        <ChatInput
          profileName={profileName}
          mode={mode}
          isResponding={isResponding}
          onSend={sendMessage}
          sendError={sendError}
          onClearError={clearSendError}
        />
      </div>
    </div>
  );
}
