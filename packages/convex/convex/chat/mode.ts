import { v, type Infer } from "convex/values";

export const chatModeValidator = v.union(
  v.literal("clone"),
  v.literal("configuration"),
);

export type ChatMode = Infer<typeof chatModeValidator>;

export const DEFAULT_CHAT_MODE: ChatMode = "clone";

/**
 * Release A quarantine for rows created by the removed owner configuration
 * agent. Delete this classifier with the legacy `mode` field in Release B.
 */
export function isLegacyConfigurationConversation(conversation: {
  mode?: ChatMode;
}): boolean {
  return conversation.mode === "configuration";
}

export function getConversationMode(conversation: {
  mode?: ChatMode;
}): ChatMode {
  return conversation.mode ?? DEFAULT_CHAT_MODE;
}
