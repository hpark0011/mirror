"use client";

import { useCallback } from "react";
import { useChatContext } from "../context/chat-context";
import { useChat } from "../hooks/use-chat";
import { ChatHeader } from "./chat-header";
import { ChatMessageList } from "./chat-message-list";
import { ChatInput } from "./chat-input";
import { cn } from "@feel-good/utils/cn";

type ChatThreadProps = {
  onBack: () => void;
};

export function ChatThread({ onBack }: ChatThreadProps) {
  const {
    profileOwnerId,
    profileName,
    avatarUrl,
    conversationId,
    conversationInvalid,
    setConversationId,
    startNewConversation,
  } = useChatContext();

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

  if (conversationInvalid || conversationNotFound) {
    return (
      <div className="flex flex-col h-full relative">
        <ChatHeader
          profileName={profileName}
          avatarUrl={avatarUrl}
          onBack={onBack}
          onNewConversation={startNewConversation}
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
      <div className="absolute top-0 left-0 right-0 z-10 bg-linear-to-b from-transparent to-transparent h-12">
        <ChatHeader
          profileName={profileName}
          avatarUrl={avatarUrl}
          onBack={onBack}
          onNewConversation={startNewConversation}
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
