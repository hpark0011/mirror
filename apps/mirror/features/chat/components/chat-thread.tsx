"use client";

import { useCallback, useState } from "react";
import { useChatContext } from "../context/chat-context";
import { useChat } from "../hooks/use-chat";
import { ArcSphere } from "../../../components/animated-geometries/arc-sphere";
import { ChatHeader } from "./chat-header";
import { ChatConversationListSheet } from "./chat-conversation-list-sheet";
import { ChatMessageList } from "./chat-message-list";
import { ChatInput } from "./chat-input";
import { cn } from "@feel-good/utils/cn";

export function ChatThread() {
  const {
    routeResolution,
    profileName,
    avatarUrl,
    conversations,
    setConversationId,
    startNewConversation,
    closeChat,
    headerAddon,
  } = useChatContext();

  const [conversationListOpen, setConversationListOpen] = useState(false);
  const openConversationList = useCallback(
    () => setConversationListOpen(true),
    [],
  );
  const activeConversationId = routeResolution.status === "ready"
    ? routeResolution.conversationId
    : null;

  const conversationListSheet = (
    <ChatConversationListSheet
      open={conversationListOpen}
      onOpenChange={setConversationListOpen}
      conversations={conversations}
      activeConversationId={activeConversationId}
      onSelect={setConversationId}
    />
  );

  if (routeResolution.status === "resolving") {
    return (
      <div className="flex flex-col h-full relative">
        {headerAddon}
        {conversationListSheet}
        <div className="absolute top-0 left-0 right-0 z-10 bg-linear-to-b from-transparent to-transparent h-12">
          <ChatHeader
            profileName={profileName}
            avatarUrl={avatarUrl}
            onProfileClick={closeChat}
            onNewConversation={startNewConversation}
            onOpenConversationList={openConversationList}
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
        {conversationListSheet}
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

  // ready | new_conversation | empty — mount useChat
  return <ChatActiveThread />;
}

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

  const [conversationListOpen, setConversationListOpen] = useState(false);
  const openConversationList = useCallback(
    () => setConversationListOpen(true),
    [],
  );
  const activeConversationId = routeResolution.status === "ready"
    ? routeResolution.conversationId
    : null;

  const handleConversationCreated = useCallback(
    (id: Parameters<typeof setConversationId>[0]) => {
      setConversationId(id);
    },
    [setConversationId],
  );

  const {
    messages,
    sendMessage,
    retryMessage,
    isStreaming,
    conversationNotFound,
    status,
    loadMore,
    sendError,
    clearSendError,
  } = useChat({
    profileOwnerId,
    conversationId,
    onConversationCreated: handleConversationCreated,
  });

  const conversationListSheet = (
    <ChatConversationListSheet
      open={conversationListOpen}
      onOpenChange={setConversationListOpen}
      conversations={conversations}
      activeConversationId={activeConversationId}
      onSelect={setConversationId}
    />
  );

  if (conversationNotFound) {
    return (
      <div className="flex flex-col h-full relative">
        {headerAddon}
        {conversationListSheet}
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
      {conversationListSheet}
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
      />

      <div
        className={cn(
          "absolute bottom-0 w-full mx-auto bg-linear-to-t from-background via-30% via-background to-transparent",
        )}
      >
        <ChatInput
          profileName={profileName}
          isStreaming={isStreaming}
          onSend={sendMessage}
          sendError={sendError}
          onClearError={clearSendError}
        />
      </div>
    </div>
  );
}
