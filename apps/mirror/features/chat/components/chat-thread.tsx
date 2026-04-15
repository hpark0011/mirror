"use client";

import { useCallback, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { ArcSphere } from "../../../components/animated-geometries/arc-sphere";
import { useChatContext } from "../context/chat-context";
import { useChat } from "../hooks/use-chat";
import { ChatConversationListSheet } from "./chat-conversation-list-sheet";
import { ChatHeader } from "./chat-header";
import { ChatInput } from "./chat-input";
import { ChatMessageList } from "./chat-message-list";

export function ChatThread() {
  const { routeResolution, profileName, avatarUrl, closeChat, headerAddon } =
    useChatContext();

  if (routeResolution.status === "resolving") {
    return (
      <div className="flex flex-col h-full relative">
        {headerAddon}
        <div className="absolute top-0 left-0 right-0 z-10 bg-linear-to-b from-transparent to-transparent h-12">
          <ChatHeader
            profileName={profileName}
            avatarUrl={avatarUrl}
            onProfileClick={closeChat}
          />
        </div>
        <div className="flex-1 flex items-center justify-center pb-20">
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
          profileName={profileName}
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
    conversationId,
    onConversationCreated: setConversationId,
  });

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
        />
        <ChatHeader
          profileName={profileName}
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
      />
      <div className="absolute top-0 left-0 right-0 z-10 bg-linear-to-b from-transparent to-transparent h-12">
        <ChatHeader
          profileName={profileName}
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
        status={status}
        loadMore={loadMore}
        onRetry={retryMessage}
        sendAnimationKey={sendAnimationKey}
      />

      <div className="absolute bottom-0 w-full mx-auto bg-linear-to-t from-background via-30% via-background to-transparent">
        <ChatInput
          profileName={profileName}
          isResponding={isResponding}
          onSend={sendMessage}
          sendError={sendError}
          onClearError={clearSendError}
        />
      </div>
    </div>
  );
}
