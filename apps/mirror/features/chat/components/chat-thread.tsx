"use client";

import { useCallback } from "react";
import { useChatContext } from "../context/chat-context";
import { useChat } from "../hooks/use-chat";
import { ChatHeader } from "./chat-header";
import { ChatMessageList } from "./chat-message-list";
import { ChatInput } from "./chat-input";

type ChatThreadProps = {
  onBack: () => void;
};

export function ChatThread({ onBack }: ChatThreadProps) {
  const {
    profileOwnerId,
    profileName,
    avatarUrl,
    conversationId,
    setConversationId,
    startNewConversation,
  } = useChatContext();

  const handleConversationCreated = useCallback(
    (id: Parameters<typeof setConversationId>[0]) => {
      setConversationId(id);
    },
    [setConversationId],
  );

  const { messages, sendMessage, isStreaming, status, loadMore } = useChat({
    profileOwnerId,
    conversationId,
    onConversationCreated: handleConversationCreated,
  });

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        profileName={profileName}
        avatarUrl={avatarUrl}
        onBack={onBack}
        onNewConversation={startNewConversation}
      />

      <ChatMessageList
        messages={messages}
        avatarUrl={avatarUrl}
        profileName={profileName}
        status={status}
        loadMore={loadMore}
      />

      <ChatInput
        profileName={profileName}
        isStreaming={isStreaming}
        onSend={sendMessage}
      />
    </div>
  );
}
